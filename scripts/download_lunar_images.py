#!/usr/bin/env python3
"""NASA Public Domain 이미지 다운로드 + 검증 스크립트"""
import urllib.request, json, subprocess, os, sys

BASE = "/Users/hare/Documents/플러스울트라/plusultra/plusultra-app"
LAND = f"{BASE}/assets/images/landing"
FEAT = f"{BASE}/assets/images/features"
os.makedirs(LAND, exist_ok=True)
os.makedirs(FEAT, exist_ok=True)

def dl(dest, url):
    """URL에서 다운로드 후 136x136 JPEG로 변환"""
    if os.path.exists(dest):
        print(f"  SKIP {os.path.basename(dest)}")
        return True
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=15) as r:
            data = r.read()
        tmp = "/tmp/_lunar_dl.raw"
        with open(tmp, "wb") as f:
            f.write(data)
        # 이미지인지 확인
        result = subprocess.run(["file", "-b", tmp], capture_output=True, text=True)
        ftype = result.stdout.lower()
        if "html" in ftype or "text" in ftype or "empty" in ftype:
            os.remove(tmp)
            return False
        # sips로 리사이즈 + JPEG 변환
        subprocess.run(
            ["sips", "-Z", "136", "-s", "format", "jpeg", "-s", "formatOptions", "60", tmp, "--out", dest],
            capture_output=True
        )
        os.remove(tmp)
        if os.path.exists(dest):
            sz = os.path.getsize(dest)
            print(f"  OK   {os.path.basename(dest)} ({sz}B)")
            return True
    except Exception as e:
        pass
    return False

def nasa_thumb(nasa_id):
    """NASA 이미지 ID로 직접 thumb URL 생성"""
    return f"https://images-assets.nasa.gov/image/{nasa_id}/{nasa_id}~thumb.jpg"

def nasa_search_verified(query, must_contain, dest):
    """NASA API 검색 후 제목에 must_contain 키워드가 포함된 결과만 사용"""
    if os.path.exists(dest):
        print(f"  SKIP {os.path.basename(dest)}")
        return True
    try:
        url = f"https://images-api.nasa.gov/search?q={query.replace(' ','+')}&media_type=image"
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read())
        for item in d.get("collection", {}).get("items", [])[:10]:
            data_list = item.get("data", [{}])
            title = data_list[0].get("title", "").lower() if data_list else ""
            desc = data_list[0].get("description", "").lower() if data_list else ""
            # 제목이나 설명에 핵심 키워드가 있는지 검증
            text = title + " " + desc
            if all(kw.lower() in text for kw in must_contain):
                for l in item.get("links", []):
                    if l.get("rel") == "preview":
                        if dl(dest, l["href"]):
                            return True
    except:
        pass
    print(f"  FAIL {os.path.basename(dest)}")
    return False

# ============================================================
# 착륙선 — 정확한 NASA 사진 ID 사용
# ============================================================
print("=== 착륙선 ===")

# Apollo (정확한 사진번호)
APOLLO_IDS = {
    "apollo11": "as11-40-5903",     # Buzz Aldrin on moon
    "apollo12": "as12-46-6726",     # Apollo 12 astronaut
    "apollo14": "as14-66-9306",     # Shepard on moon
    "apollo15": "as15-88-11866",    # Flag, rover, LM, Irwin
    "apollo16": "as16-113-18339",   # Apollo 16 LM
    "apollo17": "as17-134-20382",   # Cernan on moon
}
for name, nasa_id in APOLLO_IDS.items():
    dl(f"{LAND}/{name}.jpg", nasa_thumb(nasa_id))

# Surveyor (NASA 사진)
dl(f"{LAND}/surveyor1.jpg", nasa_thumb("GPN-2000-001938"))  # Surveyor 1 spacecraft
nasa_search_verified("Surveyor 3 Apollo 12 camera moon", ["surveyor"], f"{LAND}/surveyor3.jpg")
nasa_search_verified("Surveyor 5 moon surface", ["surveyor", "5"], f"{LAND}/surveyor5.jpg")
nasa_search_verified("Surveyor 6 spacecraft moon", ["surveyor", "6"], f"{LAND}/surveyor6.jpg")
nasa_search_verified("Surveyor 7 spacecraft Tycho", ["surveyor", "7"], f"{LAND}/surveyor7.jpg")

# Ranger
nasa_search_verified("Ranger 7 moon last photo", ["ranger", "7"], f"{LAND}/ranger7.jpg")
nasa_search_verified("Ranger 8 moon photo", ["ranger", "8"], f"{LAND}/ranger8.jpg")
nasa_search_verified("Ranger 9 moon crater", ["ranger", "9"], f"{LAND}/ranger9.jpg")

# NASA 기타
nasa_search_verified("LCROSS impact moon south pole", ["lcross"], f"{LAND}/lcross.jpg")
nasa_search_verified("GRAIL spacecraft moon gravity", ["grail"], f"{LAND}/grail.jpg")
nasa_search_verified("LADEE spacecraft moon launch", ["ladee"], f"{LAND}/ladee.jpg")
nasa_search_verified("Lunar Reconnaissance Orbiter spacecraft", ["lunar reconnaissance"], f"{LAND}/lro.jpg")
nasa_search_verified("Lunar Prospector spacecraft", ["lunar prospector"], f"{LAND}/lunar_prospector.jpg")

# Odysseus (Intuitive Machines - NASA CLPS)
nasa_search_verified("Odysseus lunar lander Intuitive Machines", ["odysseus"], f"{LAND}/odysseus.jpg")

# Luna 시리즈 (NASA API에서 검색)
nasa_search_verified("Luna 16 sample return Soviet", ["luna"], f"{LAND}/luna16.jpg")
nasa_search_verified("Lunokhod 2 rover tracks moon LRO", ["lunokhod"], f"{LAND}/luna21.jpg")

# ============================================================
# 지형 — NASA LRO/Photojournal PIA 번호 (검증된 것)
# ============================================================
print("\n=== 지형 ===")

# NASA API에서 크레이터/지형 이름으로 검색 + 제목 검증
FEATURES = [
    ("Tycho crater moon LRO", ["tycho"], "tycho.jpg"),
    ("Copernicus crater moon LRO", ["copernicus"], "copernicus.jpg"),
    ("Plato crater moon", ["plato"], "plato.jpg"),
    ("Aristarchus crater moon bright", ["aristarchus"], "aristarchus.jpg"),
    ("Sinus Iridum moon bay", ["sinus iridum"], "sinus_iridum.jpg"),
    ("Mare Tranquillitatis moon Apollo", ["tranquillitatis"], "mare_tranquillitatis.jpg"),
    ("Clavius crater moon south", ["clavius"], "clavius.jpg"),
    ("Montes Apenninus moon Apollo 15", ["apennin"], "montes_apenninus.jpg"),
    ("Rupes Recta straight wall moon", ["recta"], "rupes_recta.jpg"),
    ("Gassendi crater moon floor", ["gassendi"], "gassendi.jpg"),
    ("Messier crater moon rays", ["messier"], "messier.jpg"),
    ("Reiner Gamma swirl moon", ["reiner"], "reiner_gamma.jpg"),
    ("Vallis Alpes moon alpine valley", ["alpes"], "vallis_alpes.jpg"),
    ("Grimaldi crater moon dark", ["grimaldi"], "grimaldi.jpg"),
    ("Theophilus crater moon", ["theophilus"], "theophilus.jpg"),
    ("Vallis Schroteri moon valley", ["schroter"], "vallis_schroteri.jpg"),
    ("Mare Crisium moon round sea", ["crisium"], "mare_crisium.jpg"),
    ("Petavius crater moon rille", ["petavius"], "petavius.jpg"),
    ("Kepler crater moon rays", ["kepler"], "kepler.jpg"),
    ("Ptolemaeus crater moon", ["ptolemaeus"], "ptolemaeus.jpg"),
    ("Moretus crater moon south", ["moretus"], "moretus.jpg"),
    ("Mons Rumker volcanic moon", ["rumker"], "mons_rumker.jpg"),
    ("Mare Frigoris moon north", ["frigoris"], "mare_frigoris.jpg"),
    ("Sinus Medii central moon", ["medii"], "sinus_medii.jpg"),
    ("Rima Ariadaeus graben moon", ["ariadaeus"], "rima_ariadaeus.jpg"),
    ("South Pole Aitken basin moon", ["aitken"], "spa.jpg"),
    ("Tsiolkovskiy crater far side", ["tsiolkovsk"], "tsiolkovskiy.jpg"),
    ("Orientale basin moon multi ring", ["orientale"], "orientale.jpg"),
    ("Mare Moscoviense far side", ["moscoviense"], "mare_moscoviense.jpg"),
    ("Von Karman crater far side moon", ["karman"], "von_karman.jpg"),
    ("Apollo basin far side moon", ["apollo", "basin"], "apollo_basin.jpg"),
    ("Korolev crater far side moon", ["korolev"], "korolev.jpg"),
    ("Gagarin crater far side moon", ["gagarin"], "gagarin.jpg"),
    ("Hertzsprung basin far side", ["hertzsprung"], "hertzsprung.jpg"),
    ("Mendeleev crater far side", ["mendeleev"], "mendeleev.jpg"),
    ("Schrodinger basin south pole moon", ["schrodinger"], "schrodinger.jpg"),
    ("Compton crater far side moon", ["compton"], "compton.jpg"),
    ("Daedalus crater far side moon", ["daedalus"], "daedalus.jpg"),
    ("Van de Graaff crater moon figure eight", ["graaff"], "van_de_graaff.jpg"),
    ("Aitken crater far side moon", ["aitken", "crater"], "aitken.jpg"),
    ("Peary crater north pole moon", ["peary"], "peary.jpg"),
]

for query, must, fname in FEATURES:
    nasa_search_verified(query, must, f"{FEAT}/{fname}")

# ============================================================
# 최종 결과
# ============================================================
land_count = len([f for f in os.listdir(LAND) if f.endswith(".jpg")])
feat_count = len([f for f in os.listdir(FEAT) if f.endswith(".jpg")])
print(f"\n=== 결과 ===")
print(f"착륙선: {land_count}개")
print(f"지 형: {feat_count}개")
print(f"모든 이미지 출처: NASA (Public Domain)")
