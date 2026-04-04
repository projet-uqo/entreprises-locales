// netlify/functions/submit.js

export async function handler(event, context) {
  try {
    if (event.httpMethod !== "POST") {
      return { statusCode: 405, body: "Méthode non autorisée" };
    }

    const data = JSON.parse(event.body || "{}");

    // Validation minimale
    if (!data.nom || !data.adresse || !data.secteur) {
      return {
        statusCode: 400,
        body: "Champs obligatoires manquants (nom, adresse, secteur)."
      };
    }

    // 1. Générer le contenu JSON
    const jsonContent = JSON.stringify(data, null, 2);
    const safeName = data.nom.replace(/\s+/g, "_").toLowerCase();
    const fileName = `soumission-${safeName}-${Date.now()}.json`;

    // 2. Infos GitHub
    const repo = "projet-uqo/entreprises-locales";
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      return {
        statusCode: 500,
        body: "GITHUB_TOKEN manquant dans les variables d'environnement."
      };
    }

    // 3. Créer une nouvelle branche à partir de main
    const mainRefRes = await fetch(
      `https://api.github.com/repos/${repo}/git/ref/heads/main`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    if (!mainRefRes.ok) {
      const text = await mainRefRes.text();
      console.error("Erreur récupération ref main:", text);
      return { statusCode: 500, body: "Impossible de récupérer la branche main." };
    }

    const mainRef = await mainRefRes.json();
    const mainSha = mainRef.object.sha;
    const branchName = `submission-${Date.now()}`;

    const createRefRes = await fetch(
      `https://api.github.com/repos/${repo}/git/refs`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: mainSha
        })
      }
    );

    if (!createRefRes.ok) {
      const text = await createRefRes.text();
      console.error("Erreur création branche:", text);
      return { statusCode: 500, body: "Impossible de créer la branche de soumission." };
    }

    // 4. Ajouter le fichier JSON dans submissions/
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
      const text = await createFileRes.text();
      console.error("Erreur création fichier:", text);
      return { statusCode: 500, body: "Impossible de créer le fichier de soumission." };
    }

    // 5. Créer la Pull Request
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
          body: `Une nouvelle entreprise a été soumise.\n\nNom : **${data.nom}**\nAdresse : ${data.adresse}\nSecteur : ${data.secteur}\n\nMerci de vérifier et d'approuver.`
        })
      }
    );

    if (!prRes.ok) {
      const text = await prRes.text();
      console.error("Erreur création PR:", text);
      return { statusCode: 500, body: "Impossible de créer la Pull Request." };
    }

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

