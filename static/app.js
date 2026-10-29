const $=id=>document.getElementById(id);
let data=[],running=false,cancel=false,filter='all';
const STORAGE_KEY='habbo-nick-checker-possible-v1';
const BACKUP_KEY='habbo-nick-checker-possible-backup-v1';
const RESULTS_KEY='habbo-nick-checker-last-results-v1';
function readArray(storage,key){
 try{const v=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(v)?v:[]}catch(e){return []}
}
function normalize(arr){return [...new Map(arr.filter(x=>typeof x==='string'&&x.trim()).map(n=>[n.toLowerCase(),n])).values()]}
let saved=normalize([...readArray(localStorage,STORAGE_KEY),...readArray(sessionStorage,BACKUP_KEY)]);
let storageWarning=false;
function persist(){
 let ok=false;
 try{localStorage.setItem(STORAGE_KEY,JSON.stringify(saved));ok=true}catch(e){}
 try{sessionStorage.setItem(BACKUP_KEY,JSON.stringify(saved))}catch(e){}
 if(!ok){storageWarning=true;$('storage-warning').textContent='O Safari não permitiu salvar permanentemente. Exporte sua lista CSV antes de sair.';$('storage-warning').hidden=false}
 return ok;
}
function saveResult(x){
 const idx=saved.findIndex(n=>n.toLowerCase()===x.nick.toLowerCase());
 if(x.status==='occupied'&&idx!==-1){saved.splice(idx,1);persist()}
 if(x.status==='not_found'&&idx===-1){saved.push(x.nick);persist()}
}
function renderSaved(){
 $('saved-count').textContent='('+saved.length+')';
 $('saved-results').innerHTML=saved.length?saved.map((n,i)=>`<tr><td>${escapeHtml(n)}</td><td><button data-remove="${i}">Remover</button></td></tr>`).join(''):'<tr><td colspan="2" class="empty">Nenhum nickname salvo.</td></tr>';
 $('export').disabled=!saved.length;
 document.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{saved.splice(Number(b.dataset.remove),1);persist();renderSaved()});
}
$('remove-saved').onclick=()=>{if(saved.length&&confirm('Apagar todos os nicknames salvos neste navegador?')){saved=[];persist();renderSaved()}};
function persistResults(){try{localStorage.setItem(RESULTS_KEY,JSON.stringify(data))}catch(e){}}
function restoreResults(){
 const previous=readArray(localStorage,RESULTS_KEY).filter(x=>x&&typeof x.nick==='string'&&typeof x.status==='string');
 if(previous.length){data=previous;for(const x of previous)if(x.status==='not_found')saveResult(x)}
}
function names(){return [...new Set($('nicks').value.split(/[\n,]+/).map(s=>s.trim()).filter(Boolean))]}
function updateCount(){let n=names().length;$('count').textContent=`${n} / 100 nicknames`;$('count').style.color=n>100?'#ff9da8':''}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function render(){let filtered=data.filter(x=>filter==='all'||x.status===filter||(filter==='other'&&['unknown','error'].includes(x.status)));$('results').innerHTML=filtered.length?filtered.map(x=>`<tr><td>${escapeHtml(x.nick)}</td><td><span class="pill ${x.status}">${({not_found:'Não encontrado',occupied:'Ocupado',unknown:'Inconclusivo',error:'Erro'})[x.status]||'Erro'}</span></td><td>${escapeHtml(x.detail)}</td></tr>`).join(''):'<tr><td colspan="3" class="empty">Nenhum resultado nesta categoria.</td></tr>';$('total').textContent=data.length;$('found').textContent=data.filter(x=>x.status==='not_found').length;$('occupied').textContent=data.filter(x=>x.status==='occupied').length;$('unknown').textContent=data.filter(x=>['unknown','error'].includes(x.status)).length;renderSaved()}
function controls(on){running=on;$('start').disabled=on;$('clear').disabled=on;$('stop').disabled=!on;$('nicks').disabled=on}
$('nicks').addEventListener('input',updateCount);
$('clear').onclick=()=>{$('nicks').value='';data=[];persistResults();filter='all';document.querySelectorAll('.filter').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));updateCount();render();$('bar').style.width='0%';$('progress-label').textContent='Pronto para verificar.'};
$('stop').onclick=()=>{cancel=true;$('stop').disabled=true};
$('start').onclick=async()=>{if(running)return;let list=names();if(!list.length){alert('Insira pelo menos um nickname.');return}if(list.length>100){alert('O limite é 100 nicknames por verificação.');return}data=[];cancel=false;render();controls(true);for(let i=0;i<list.length;i++){if(cancel)break;let result;try{let res=await fetch('/api/check',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nick:list[i]})});if(!res.ok)throw Error(`HTTP ${res.status}`);result=await res.json()}catch(e){result={nick:list[i],status:'error',detail:'Falha na consulta: '+e.message}}data.push(result);persistResults();saveResult(result);render();$('bar').style.width=`${Math.round(100*data.length/list.length)}%`;$('progress-label').textContent=`${data.length} de ${list.length} verificados`;if(result.detail?.includes('429')){$('progress-label').textContent='Limite de requisições atingido. Verificação interrompida.';break}}controls(false);if(cancel)$('progress-label').textContent+= ' · Interrompido';else if(data.length===list.length)$('progress-label').textContent+=' · Concluído'};
document.querySelectorAll('.filter').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('.filter').forEach(x=>x.classList.toggle('active',x===b));render()});
$('export').onclick=()=>{const rows=[['Nickname'],...saved.map(n=>[n])];const csv='\ufeff'+rows.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\r\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.download='habbo-possivelmente-disponiveis.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
restoreResults();persist();updateCount();render();