import os
import json
import pandas as pd
import numpy as np
from openpyxl import load_workbook
import html

APPROVED_DIR = "approved"
EXCEL_FILE = "Informations sur les entreprises.xlsx"
SHEET_NAME = "Entreprises"

# -----------------------------
# 🔐 VALIDATION DES DONNÉES
# -----------------------------

def validate_submission(data):
    """
    Valide une soumission JSON avant insertion dans l'Excel.
    Retourne un tuple (ok, message).
    """

    required_fields = ["nom", "adresse", "secteur"]

    # Vérifier les champs obligatoires
    for field in required_fields:
        if field not in data or not str(data[field]).strip():
            return False, f"Champ obligatoire manquant : {field}"

    # Longueurs maximales (évite les abus)
    if len(data["nom"]) > 200:
        return False, "Nom trop long"
    if len(data["adresse"]) > 300:
        return False, "Adresse trop longue"
    if len(data["secteur"]) > 200:
        return False, "Secteur trop long"

    # Nettoyage anti‑XSS
    for key in data:
        if isinstance(data[key], str):
            data[key] = html.escape(data[key].strip())

    return True, "OK"


# -----------------------------
# 📥 LECTURE DES FICHIERS APPROUVÉS
# -----------------------------

def load_approved_submissions():
    files = [
        f for f in os.listdir(APPROVED_DIR)
        if f.endswith(".json")
    ]
    return files


# -----------------------------
# 🧩 INSERTION DANS L'EXCEL
# -----------------------------

def insert_into_excel(entries):
    """
    entries = liste de dicts validés
    """

    # Charger l'Excel existant
    xls = pd.ExcelFile(EXCEL_FILE)
    df = pd.read_excel(xls, sheet_name=SHEET_NAME)

    # Normaliser les colonnes
    df.columns = df.columns.str.strip()

    # Convertir les entrées JSON en DataFrame
    new_rows = []
    for e in entries:
        new_rows.append({
            "Nom de l'entreprise": e["nom"],
            "Adresse": e["adresse"],
            "Site internet": e.get("site", ""),
            "Secteur": e["secteur"],
            "Logo": e.get("logo", ""),
            "Latitude": np.nan,
            "Longitude": np.nan
        })

    df_new = pd.DataFrame(new_rows)

    # Ajouter les nouvelles lignes
    df_final = pd.concat([df, df_new], ignore_index=True)

    # Sauvegarde SANS écraser les autres feuilles
    book = load_workbook(EXCEL_FILE)

    with pd.ExcelWriter(
        EXCEL_FILE,
        engine="openpyxl",
        mode="a",
        if_sheet_exists="replace"
    ) as writer:
        writer._book = book
        writer._sheets = book.worksheets
        df_final.to_excel(writer, sheet_name=SHEET_NAME, index=False)


# -----------------------------
# 🗑️ SUPPRESSION DES FICHIERS TRAITÉS
# -----------------------------

def delete_processed(files):
    for f in files:
        os.remove(os.path.join(APPROVED_DIR, f))


# -----------------------------
# 🚀 MAIN
# -----------------------------

def main():
    print("🔍 Recherche de fichiers approuvés...")

    files = load_approved_submissions()

    if not files:
        print("Aucune soumission approuvée à traiter.")
        return

    print(f"📄 {len(files)} fichier(s) trouvé(s).")

    valid_entries = []
    processed_files = []

    for filename in files:
        path = os.path.join(APPROVED_DIR, filename)

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            print(f"❌ Erreur : impossible de lire {filename}")
            continue

        ok, msg = validate_submission(data)
        if not ok:
            print(f"❌ Soumission invalide ({filename}) : {msg}")
            continue

        valid_entries.append(data)
        processed_files.append(filename)

    if not valid_entries:
        print("⚠️ Aucune soumission valide.")
        return

    print(f"📝 Insertion de {len(valid_entries)} nouvelle(s) entreprise(s) dans l'Excel...")

    insert_into_excel(valid_entries)

    print("🗑️ Suppression des fichiers traités...")
    delete_processed(processed_files)

    print("✅ Terminé !")


if __name__ == "__main__":
    main()
