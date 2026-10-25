const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const html=fs.readFileSync('index.html','utf8'),js=fs.readFileSync('app.js','utf8');
new vm.Script(js,{filename:'app.js'});new vm.Script(fs.readFileSync('sw.js','utf8'),{filename:'sw.js'});
for(const page of ['inicio','ranking','misxp','niveles','mas']){
 assert.match(html,new RegExp('id="view-'+page+'"'));
 assert.match(html,new RegExp('data-target="'+page+'"'));
}
for(const id of [...new Set([...js.matchAll(/\$\('([^']+)'\)/g)].map(x=>x[1]))]){
 assert.ok(html.includes(`id="${id}"`),'Missing ID '+id);
}
for(const endpoint of ['ranking_publico','ranking_sesion_publico','estudia_niveles_publicos','estudia_sesiones_publicas','estudia_mi_progreso']){
 assert.match(js,new RegExp(endpoint));
}
assert.doesNotMatch(js,/\.from\(['"]puntos_eventos|\.insert\(|\.update\(|\.delete\(|localStorage\.|sessionStorage\./);
assert.match(html,/ranking\.movidasst\.com/);
assert.match(html,/assets\/og-ranking\.png/);
assert.equal(fs.readFileSync('CNAME','utf8').trim(),'ranking.movidasst.com');
assert.equal(JSON.parse(fs.readFileSync('manifest.webmanifest','utf8')).display,'standalone');
assert.match(html,/value="todos" selected>Todos los estudios/);
assert.match(js,/ranking_todos_estudios_publico/);
assert.match(js,/state\.studyId==='todos'/);
assert.match(js,/id==='todos'\s*\? await fetchAllStudyRanking\(\)/);
assert.match(fs.readFileSync('sw.js','utf8'),/ranking-sst-shell-v5/);
console.log('All ranking SST smoke checks passed.');

assert.match(html,/class="header-home round-btn"[^>]*aria-label="Ir al inicio/);
assert.match(html,/href="https:\/\/registro\.movidasst\.com\/" class="header-register"/);
assert.doesNotMatch(html,/href="https:\/\/(?:www|registro)\.movidasst\.com\/"[^>]*target="_blank"/);
assert.match(js,/lh3\.googleusercontent\.com\/d\//);
assert.match(js,/data-ranking-photo/);
assert.match(js,/backupPhoto/);
assert.match(fs.readFileSync('sw.js','utf8'),/ranking-sst-shell-v5/);

assert.match(html,/class="brand brand-official"/);
assert.match(html,/class="brand-logo-img"/);
assert.match(html,/class="hero-official-logo"/);
assert.match(html,/assets\/logo-oficial-movida-sst-plus\.png/);
assert.match(fs.readFileSync('styles.css','utf8'),/hero-logo-stage/);
assert.match(fs.readFileSync('sw.js','utf8'),/ranking-sst-shell-v5/);
assert.ok(fs.statSync('assets/logo-oficial-movida-sst-plus.png').size>50000);
