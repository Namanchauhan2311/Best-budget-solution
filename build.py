# Assembles index.html from template.html + engine.js + store.js + app.js
t = open('template.html').read()
for marker, f in (('/*ENGINE*/', 'engine.js'), ('/*STORE*/', 'store.js'), ('/*APP*/', 'app.js')):
    assert marker in t, marker
    t = t.replace(marker, open(f).read())
open('index.html', 'w').write(t)
print('index.html built')
