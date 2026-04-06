// netlify/functions/submit.js

export async function handler(event, context) {
  try {
    // 1. Méthode autorisée
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Méthode non autorisée." };
    }

    // 2. Vérification de l'origine (anti-abus)
    const allowedOrigin = "https://entreprises-locales.netlify.app";
    const origin = event.headers.origin || event.headers.referer || "";

    if (!origin.startsWith(allowedOrigin)) {
      return { statusCode: 403, body: "Origine non autorisée." };
    }

    // 3. Récupération des données
    const data = JSON.parse(event.body || "{}");

    // 4. Honeypot anti-bot
    if (data.website && data.website.trim() !== "") {
      return { statusCode: 400, body: "Bot détecté." };
    }

    // 5. Fonction de nettoyage
    function sanitize(input, max = 100) {
      if (!input) return "";
      return String(input)
        .trim()
        .replace(/[<>]/g, "")     // empêche les injections HTML
        .replace(/[\n\r]/g, " ")  // empêche les retours de ligne
        .substring(0, max);
    }

    // 6. Nettoyage des champs
    data.nom = sanitize(data.nom, 80);
    data.adresse = sanitize(data.adresse, 120);
    data.secteur = sanitize(data.secteur, 60);
    data.site = sanitize(data.site, 200);
    data.logo = sanitize(data.logo, 200);
    data.description = sanitize(data.description, 500);

    // 7. Validation stricte
    if (!data.nom || data.nom.length < 2) {
      return { statusCode: 400, body: "Nom invalide." };
    }
    if (!data.adresse || data.adresse.length < 5) {
      return { statusCode: 400, body: "Adresse invalide." };
    }
    if (!data.secteur || data.secteur.length < 2) {
      return { statusCode: 400, body: "Secteur invalide." };
    }

    // 8. Préparation du fichier JSON
    const jsonContent = JSON.stringify(data, null, 2);
    const safeName = data.nom.replace(/\s+/g, "_").toLowerCase();
    const fileName = `soumission-${safeName}-${Date.now()}.json`;

    // 9. GitHub API
    const repo = "projet-uqo/entreprises-locales";
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      return { statusCode: 500, body: "GITHUB_TOKEN manquant." };
    }

    // 10. Récupération du SHA de main
    const mainRefRes = await fetch(
      `https://api.github.com/repos/${repo}/git/ref/heads/main`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!mainRefRes.ok) {
      return { statusCode: 500, body: "Impossible de récupérer la branche main." };
    }

    const mainRef = await mainRefRes.json();
    const mainSha = mainRef.object.sha;
    const branchName = `submission-${Date.now()}`;

    // 11. Création de la branche
    await fetch(`https://api.github.com/repos/${repo}/git/refs`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: mainSha
      })
    });

    // 12. Ajout du fichier JSON
    const createFileRes = await fetch(
      `https://api.github.com/repos/${repo}/contents/submissions/${fileName}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: `Nouvelle soumission : ${data.nom}`,
          content: Buffer.from(jsonContent).toString("base64"),
          branch: branchName
        })
      }
    );

    if (!createFileRes.ok) {
      return { statusCode: 500, body: "Impossible de créer le fichier de soumission." };
    }

    // 13. Création de la Pull Request
    const prRes = await fetch(
      `https://api.github.com/repos/${repo}/pulls`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: `Nouvelle soumission : ${data.nom}`,
          head: branchName,
          base: "main",
          body: `Une nouvelle entreprise a été soumise.\n\nNom : **${data.nom}**\nAdresse : ${data.adresse}\nSecteur : ${data.secteur}`
        })
      }
    );

    const pr = await prRes.json();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Soumission envoyée avec succès.",
        pr_url: pr.html_url
      })
    };

  } catch (error) {
    console.error("Erreur submit.js:", error);
    return { statusCode: 500, body: "Erreur interne du serveur." };
  }
}
