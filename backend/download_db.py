import os
import urllib.request

DATA_DIR = os.path.join(os.path.dirname(__file__), "app", "data")
DB_PATH = os.path.join(DATA_DIR, "GeoLite2-Country.mmdb")
URL = "https://raw.githubusercontent.com/P3TERX/GeoLite.mmdb/download/GeoLite2-Country.mmdb"

def download_database():
    os.makedirs(DATA_DIR, exist_ok=True)
    print(f"Downloading GeoLite2-Country.mmdb from {URL}...")
    try:
        urllib.request.urlretrieve(URL, DB_PATH)
        print(f"Download complete! Saved to {DB_PATH}")
        print(f"File size: {os.path.getsize(DB_PATH) / (1024 * 1024):.2f} MB")
    except Exception as e:
        print(f"Error downloading GeoLite2 database: {e}")
        # If it fails, write an empty dummy file or handle gracefully
        if not os.path.exists(DB_PATH):
            with open(DB_PATH, "w") as f:
                f.write("")

if __name__ == "__main__":
    download_database()
