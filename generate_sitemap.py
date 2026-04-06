# -*- coding: utf-8 -*-
"""generate_sitemap.ipynb



"""
# Importer les librairies nécessaires.
import os
from datetime import datetime

# Dossier où tes fichiers HTML sont générés
SITE_DIR = "site"
BASE_URL = "https://entreprises-locales.netlify.app"  # ⚠️ Modifié pour Netlify

# Pour savoir s'il y a une erreur
if not os.path.exists(SITE_DIR):
    print(f"Dossier '{SITE_DIR}' introuvable")
    exit(1)

# Générer sitemap.xml
def generate_sitemap():
    urls = []
    for file in sorted(os.listdir(SITE_DIR)):
        if file.endswith(".html"):
            # 🚫 Exclure le fichier de validation Google et la carte PME individuelle
            if file.startswith("google") or file == "carte_pme_gatineau.html":
                continue
                
            loc = f"{BASE_URL}/{file}"
            lastmod = datetime.today().strftime("%Y-%m-%d")
            urls.append(f"""
  <url>
    <loc>{loc}</loc>
    <lastmod>{lastmod}</lastmod>
    <priority>{'1.0' if file == 'index.html' else '0.8'}</priority>
  </url>""")

    sitemap_content = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{''.join(urls)}
</urlset>
"""
    with open(os.path.join(SITE_DIR, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write(sitemap_content)
    print("✅ sitemap.xml généré")
    print(f"✅ {len(urls)} pages ajoutées au sitemap")
    print("🔍 Exemples d'URLs dans le sitemap :")
    for url in urls[:3]:
        print(url.strip())



# Générer robots.txt
def generate_robots():
    robots_content = f"""User-agent: *
Allow: /

Sitemap: {BASE_URL}/sitemap.xml
"""
    with open(os.path.join(SITE_DIR, "robots.txt"), "w", encoding="utf-8") as f:
        f.write(robots_content)
    print("✅ robots.txt généré")

if __name__ == "__main__":
    generate_sitemap()
    generate_robots()
