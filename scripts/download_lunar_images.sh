#!/bin/bash
# NASA 퍼블릭 도메인 이미지만 사용 (저작권 FREE)
# 소스: images-assets.nasa.gov, nssdc.gsfc.nasa.gov
BASE="/Users/hare/Documents/플러스울트라/plusultra/plusultra-app"
LAND="$BASE/assets/images/landing"
FEAT="$BASE/assets/images/features"

dl() {
  local dest="$1"; shift
  if [ -f "$dest" ]; then echo "SKIP $(basename $dest)"; return 0; fi
  for url in "$@"; do
    curl -sL -A "Mozilla/5.0" -o /tmp/_dl.raw "$url" 2>/dev/null
    local ftype=$(file -b /tmp/_dl.raw 2>/dev/null)
    if echo "$ftype" | grep -qi "JPEG\|PNG\|GIF\|TIFF\|Web"; then
      sips -Z 136 -s format jpeg -s formatOptions 60 /tmp/_dl.raw --out "$dest" >/dev/null 2>&1
      if [ -f "$dest" ]; then
        rm -f /tmp/_dl.raw
        echo "OK   $(basename $dest) ($(wc -c < "$dest" | tr -d ' ')B)"
        return 0
      fi
    fi
    rm -f /tmp/_dl.raw
  done
  echo "FAIL $(basename $dest)"
  return 1
}

# NASA API 검색 헬퍼
nasa_search() {
  local query="$1" dest="$2"
  if [ -f "$dest" ]; then echo "SKIP $(basename $dest)"; return 0; fi
  local url=$(curl -sL "https://images-api.nasa.gov/search?q=${query}&media_type=image" 2>/dev/null | python3 -c "
import sys,json
d=json.load(sys.stdin)
for item in d.get('collection',{}).get('items',[])[:1]:
  for l in item.get('links',[]):
    if l.get('rel')=='preview':
      print(l.get('href',''))
      break
" 2>/dev/null)
  if [ -n "$url" ]; then
    dl "$dest" "$url"
  else
    echo "FAIL $(basename $dest) (no NASA result)"
  fi
}

echo "=== 착륙선 (NASA only) ==="
# Apollo (NASA 직접)
dl "$LAND/apollo11.jpg" "https://images-assets.nasa.gov/image/as11-40-5903/as11-40-5903~thumb.jpg"
dl "$LAND/apollo12.jpg" "https://images-assets.nasa.gov/image/as12-46-6813/as12-46-6813~thumb.jpg"
dl "$LAND/apollo14.jpg" "https://images-assets.nasa.gov/image/as14-66-9306/as14-66-9306~thumb.jpg"
dl "$LAND/apollo15.jpg" "https://images-assets.nasa.gov/image/as15-88-11866/as15-88-11866~thumb.jpg"
dl "$LAND/apollo16.jpg" "https://images-assets.nasa.gov/image/as16-113-18339/as16-113-18339~thumb.jpg"
dl "$LAND/apollo17.jpg" "https://images-assets.nasa.gov/image/as17-134-20382/as17-134-20382~thumb.jpg"

# Surveyor (NASA)
dl "$LAND/surveyor1.jpg" "https://images-assets.nasa.gov/image/PIA02975/PIA02975~thumb.jpg"
dl "$LAND/surveyor3.jpg" "https://images-assets.nasa.gov/image/as12-48-7133/as12-48-7133~thumb.jpg"
dl "$LAND/surveyor5.jpg" "https://nssdc.gsfc.nasa.gov/planetary/image/surveyor5_1.jpg"
dl "$LAND/surveyor6.jpg" "https://nssdc.gsfc.nasa.gov/planetary/image/surveyor6_1.jpg"
dl "$LAND/surveyor7.jpg" "https://nssdc.gsfc.nasa.gov/planetary/image/surveyor7_1.jpg"

# Ranger (NASA)
dl "$LAND/ranger7.jpg" "https://images-assets.nasa.gov/image/PIA02945/PIA02945~thumb.jpg"

# Luna (NSSDC - NASA 아카이브)
dl "$LAND/luna2.jpg" "https://nssdc.gsfc.nasa.gov/image/spacecraft/luna2.gif"
dl "$LAND/luna9.jpg" "https://nssdc.gsfc.nasa.gov/planetary/image/luna9_2.jpg"
dl "$LAND/luna13.jpg" "https://nssdc.gsfc.nasa.gov/planetary/image/luna13_1.jpg"
dl "$LAND/luna16.jpg" "https://nssdc.gsfc.nasa.gov/image/spacecraft/luna16.gif"
dl "$LAND/luna17.jpg" "https://nssdc.gsfc.nasa.gov/image/spacecraft/lunokhod1.gif"
dl "$LAND/luna21.jpg" "https://nssdc.gsfc.nasa.gov/image/spacecraft/lunokhod2.gif"
dl "$LAND/luna24.jpg" "https://nssdc.gsfc.nasa.gov/image/spacecraft/luna24.gif"

# 기타 NASA 미션
dl "$LAND/lcross.jpg" "https://images-assets.nasa.gov/image/lcross_impact/lcross_impact~thumb.jpg"
nasa_search "LCROSS+moon+impact" "$LAND/lcross.jpg"
dl "$LAND/lunar_prospector.jpg" "https://nssdc.gsfc.nasa.gov/image/spacecraft/lunar_prospector.gif"
nasa_search "Lunar+Prospector+spacecraft" "$LAND/lunar_prospector.jpg"
dl "$LAND/grail.jpg" "https://images-assets.nasa.gov/image/PIA14756/PIA14756~thumb.jpg"
dl "$LAND/ladee.jpg" "https://images-assets.nasa.gov/image/ladee1/ladee1~thumb.jpg"
dl "$LAND/lro.jpg" "https://images-assets.nasa.gov/image/lro20090618/lro20090618~thumb.jpg"

# 비NASA (NASA에 있을 수 있는 것만)
nasa_search "Chandrayaan+3+moon" "$LAND/chandrayaan3.jpg"
nasa_search "Chang'e+4+moon+far+side" "$LAND/change4.jpg"
nasa_search "Chang'e+3+Yutu+moon" "$LAND/change3.jpg"
nasa_search "SLIM+JAXA+moon" "$LAND/slim.jpg"
nasa_search "Beresheet+moon+Israel" "$LAND/beresheet.jpg"
nasa_search "Odysseus+Intuitive+Machines" "$LAND/odysseus.jpg"
nasa_search "SMART-1+moon" "$LAND/smart1.jpg"
nasa_search "Kaguya+SELENE+moon" "$LAND/kaguya.jpg"

echo ""
echo "=== 지형 (NASA LRO/PIA) ==="
# 주요 지형 — NASA PIA 또는 LRO 이미지 (전부 public domain)
dl "$FEAT/tycho.jpg" "https://images-assets.nasa.gov/image/PIA13893/PIA13893~thumb.jpg"
dl "$FEAT/copernicus.jpg" "https://images-assets.nasa.gov/image/PIA13642/PIA13642~thumb.jpg"
dl "$FEAT/plato.jpg" "https://images-assets.nasa.gov/image/PIA14020/PIA14020~thumb.jpg"
dl "$FEAT/aristarchus.jpg" "https://images-assets.nasa.gov/image/PIA13643/PIA13643~thumb.jpg"
dl "$FEAT/sinus_iridum.jpg" "https://images-assets.nasa.gov/image/PIA13893/PIA13893~thumb.jpg"
dl "$FEAT/mare_tranquillitatis.jpg" "https://images-assets.nasa.gov/image/PIA12925/PIA12925~thumb.jpg"
dl "$FEAT/clavius.jpg" "https://images-assets.nasa.gov/image/PIA12932/PIA12932~thumb.jpg"
dl "$FEAT/montes_apenninus.jpg" "https://images-assets.nasa.gov/image/as15-87-11719/as15-87-11719~thumb.jpg"
dl "$FEAT/rupes_recta.jpg" "https://images-assets.nasa.gov/image/PIA13506/PIA13506~thumb.jpg"
dl "$FEAT/gassendi.jpg" "https://images-assets.nasa.gov/image/PIA14016/PIA14016~thumb.jpg"
dl "$FEAT/messier.jpg" "https://images-assets.nasa.gov/image/PIA13515/PIA13515~thumb.jpg"
dl "$FEAT/reiner_gamma.jpg" "https://images-assets.nasa.gov/image/PIA13510/PIA13510~thumb.jpg"
dl "$FEAT/vallis_alpes.jpg" "https://images-assets.nasa.gov/image/PIA14006/PIA14006~thumb.jpg"
dl "$FEAT/grimaldi.jpg" "https://images-assets.nasa.gov/image/PIA13500/PIA13500~thumb.jpg"
dl "$FEAT/theophilus.jpg" "https://images-assets.nasa.gov/image/PIA13504/PIA13504~thumb.jpg"
dl "$FEAT/vallis_schroteri.jpg" "https://images-assets.nasa.gov/image/PIA13513/PIA13513~thumb.jpg"
dl "$FEAT/mare_crisium.jpg" "https://images-assets.nasa.gov/image/PIA12874/PIA12874~thumb.jpg"
dl "$FEAT/petavius.jpg" "https://images-assets.nasa.gov/image/PIA13505/PIA13505~thumb.jpg"
dl "$FEAT/kepler.jpg" "https://images-assets.nasa.gov/image/PIA13503/PIA13503~thumb.jpg"
dl "$FEAT/ptolemaeus.jpg" "https://images-assets.nasa.gov/image/PIA14021/PIA14021~thumb.jpg"
dl "$FEAT/moretus.jpg" "https://images-assets.nasa.gov/image/PIA12933/PIA12933~thumb.jpg"
dl "$FEAT/mons_rumker.jpg" "https://images-assets.nasa.gov/image/PIA13511/PIA13511~thumb.jpg"
dl "$FEAT/mare_frigoris.jpg" "https://images-assets.nasa.gov/image/PIA12872/PIA12872~thumb.jpg"
dl "$FEAT/spa.jpg" "https://images-assets.nasa.gov/image/PIA12871/PIA12871~thumb.jpg"
dl "$FEAT/tsiolkovskiy.jpg" "https://images-assets.nasa.gov/image/PIA12934/PIA12934~thumb.jpg"
dl "$FEAT/orientale.jpg" "https://images-assets.nasa.gov/image/PIA13226/PIA13226~thumb.jpg"
dl "$FEAT/mare_moscoviense.jpg" "https://images-assets.nasa.gov/image/PIA13507/PIA13507~thumb.jpg"
dl "$FEAT/von_karman.jpg" "https://images-assets.nasa.gov/image/PIA23236/PIA23236~thumb.jpg"
dl "$FEAT/schrodinger.jpg" "https://images-assets.nasa.gov/image/PIA12935/PIA12935~thumb.jpg"
dl "$FEAT/korolev.jpg" "https://images-assets.nasa.gov/image/PIA13509/PIA13509~thumb.jpg"
dl "$FEAT/gagarin.jpg" "https://images-assets.nasa.gov/image/PIA13508/PIA13508~thumb.jpg"
dl "$FEAT/hertzsprung.jpg" "https://images-assets.nasa.gov/image/PIA13501/PIA13501~thumb.jpg"
dl "$FEAT/mendeleev.jpg" "https://images-assets.nasa.gov/image/PIA13502/PIA13502~thumb.jpg"
dl "$FEAT/compton.jpg" "https://images-assets.nasa.gov/image/PIA13497/PIA13497~thumb.jpg"
dl "$FEAT/daedalus.jpg" "https://images-assets.nasa.gov/image/PIA13498/PIA13498~thumb.jpg"
dl "$FEAT/van_de_graaff.jpg" "https://images-assets.nasa.gov/image/PIA13512/PIA13512~thumb.jpg"
dl "$FEAT/sinus_medii.jpg" "https://images-assets.nasa.gov/image/PIA14005/PIA14005~thumb.jpg"
dl "$FEAT/rima_ariadaeus.jpg" "https://images-assets.nasa.gov/image/PIA13514/PIA13514~thumb.jpg"
dl "$FEAT/aitken.jpg" "https://images-assets.nasa.gov/image/PIA12873/PIA12873~thumb.jpg"
dl "$FEAT/peary.jpg" "https://images-assets.nasa.gov/image/PIA12936/PIA12936~thumb.jpg"
dl "$FEAT/apollo_basin.jpg" "https://images-assets.nasa.gov/image/PIA12875/PIA12875~thumb.jpg"

echo ""
echo "=== 최종 결과 ==="
echo "Landing: $(ls "$LAND"/*.jpg 2>/dev/null | wc -l | tr -d ' ') files, $(du -sh "$LAND" 2>/dev/null | cut -f1)"
echo "Features: $(ls "$FEAT"/*.jpg 2>/dev/null | wc -l | tr -d ' ') files, $(du -sh "$FEAT" 2>/dev/null | cut -f1)"
echo ""
echo "모든 이미지 출처: NASA (Public Domain - 저작권 없음)"
