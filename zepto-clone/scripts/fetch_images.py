# Dev-time helper: downloads openly licensed product photos from Wikimedia Commons into public/products/
# and writes public/products/CREDITS.json. Run: python3 scripts/fetch_images.py  (images are already included in the repo)
import json, re, sys, urllib.request, urllib.parse, os, time, html
Q = {
1:'Bunch of bananas',2:'Tomatoes red white background',3:'Onion bulbs white background',4:'Red apples white background',
5:'Spinach leaves',6:'Carrots white background',7:'Milk bottle glass dairy',8:'Eggs brown white background',9:'Paneer cheese cubes',
10:'Curd yogurt bowl',11:'Butter block',12:'Potato chips bowl',13:'Instant noodles packet',14:'Chocolate chip cookies',
15:'Popcorn bowl',16:'Dark chocolate bar',17:'Glass of cola with ice cubes',18:'Orange juice glass',19:'Iced tea glass lemon',20:'Mineral water plastic bottle',
21:'Brown bread loaf sliced',22:'Croissant',23:'Bread rolls buns basket',24:'Plain shampoo bottle white background',25:'Toothpaste on toothbrush',26:'Bar soap',
27:'Cup noodles',28:'Energy drink can',29:'Nescafe instant coffee jar',30:'Vanilla ice cream scoops bowl',31:'Chocolate biscuits',
32:'Protein bar',33:'Peanut butter jar',34:'Hot chocolate mug',35:'Soup packet instant soup',36:'Ginger tea cup',37:'Oral rehydration salts'}
OK = re.compile(r'^(cc0|public domain|pd|cc[- ]by(-sa)?[- ][\d.]+|cc by(-sa)? [\d.]+)', re.I)
def api(params):
    url='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers={'User-Agent':'zippy-student-project/1.0'})
    return json.load(urllib.request.urlopen(req,timeout=20))
out=json.load(open('public/products/CREDITS.json')) if os.path.exists('public/products/CREDITS.json') else {}
out={int(k):v for k,v in out.items()}
ONLY=set(map(int,sys.argv[1:]))
for pid,q in Q.items():
    if ONLY and pid not in ONLY: continue
    if not ONLY and pid in out: continue
    for attempt in range(6):
      try:
        break
      except Exception: pass
    try:
        for attempt in range(6):
            try: d=api({'action':'query','format':'json','generator':'search','gsrnamespace':6,'gsrsearch':q+' filetype:bitmap','gsrlimit':8,'prop':'imageinfo','iiprop':'url|extmetadata|mime','iiurlwidth':420}); break
            except urllib.error.HTTPError as e:
                if e.code!=429: raise
                time.sleep(8*(attempt+1))
    except Exception as e:
        print(pid,'ERR',e); continue
    pages=sorted(d.get('query',{}).get('pages',{}).values(),key=lambda p:p['index'])
    for p in pages:
        ii=p['imageinfo'][0]; md=ii.get('extmetadata',{})
        lic=md.get('LicenseShortName',{}).get('value','')
        if ii['mime']!='image/jpeg' or not OK.match(lic) or ii.get('thumbwidth',0)<300: continue
        art=re.sub('<[^>]+>','',md.get('Artist',{}).get('value','unknown'))
        path=f'public/products/{pid}.jpg'
        req=urllib.request.Request(ii['thumburl'],headers={'User-Agent':'zippy-student-project/1.0'})
        ok=False
        for attempt in range(5):
            try: open(path,'wb').write(urllib.request.urlopen(req,timeout=30).read()); ok=True; break
            except Exception as e: time.sleep(6*(attempt+1))
        if not ok: print(pid,'dl fail'); continue
        out[pid]={'file':p['title'],'license':lic,'author':html.unescape(art)[:80],'url':ii['descriptionurl']}
        print(pid,q,'->',p['title'],lic); break
    else: print(pid,q,'NO MATCH')
    time.sleep(2.5)
json.dump({str(k):v for k,v in out.items()},open('public/products/CREDITS.json','w'),indent=1,ensure_ascii=False)
