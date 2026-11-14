# Assembles index.html from template.html + engine.js
t = open('template.html').read()
e = open('engine.js').read()
assert '/*ENGINE*/' in t
open('index.html', 'w').write(t.replace('/*ENGINE*/', e))
print('index.html built')
