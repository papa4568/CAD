(() => {
'use strict';
const $ = s => document.querySelector(s);
const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icons = {
shield:'<path d="M12 3 20 6v6c0 5-8 9-8 9s-8-4-8-9V6z"/><path d="m8 12 3 3 5-6"/>',
plane:'<path d="m12 3 2 7 7 4v2l-7-2v5l2 2h-8l2-2v-5l-7 2v-2l7-4z"/>',
grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
list:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M8 9v11M12 13h5M12 16h5"/>',
files:'<path d="M14 2H6a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 12h8M8 16h6"/>',
lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/>',
clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
alert:'<path d="m12 3 10 18H2zM12 9v5M12 17h.01"/>',
calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3M14 14h3"/>',
arrow:'<path d="M5 12h14m-5-5 5 5-5 5"/>',
up:'<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>',
download:'<path d="M12 3v13m-5-5 5 5 5-5M4 16v5h16v-5"/>',
search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
check:'<path d="m5 12 4 4L19 6"/>',
close:'<path d="m6 6 12 12M18 6 6 18"/>',
print:'<path d="M7 8V3h10v5M7 17H3V8h18v9h-4M7 14h10v7H7zM17 11h1"/>',
refresh:'<path d="M20 10a8 8 0 0 0-14-5L3 8m0-5v5h5M4 14a8 8 0 0 0 14 5l3-3m0 5v-5h-5"/>',
chevron:'<path d="m9 5 7 7-7 7"/>',
flag:'<path d="M5 21V3m0 1c6-4 8 4 14 0v9c-6 4-8-4-14 0"/>',
moon:'<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5 9 9 0 1 0 20.5 14.2z"/>',
sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.files}</svg>`;
let E, S, loading = true, currentTab = 'overview', bucket = 'all', page = 1, selectedId = null, lastFocus, toastTimer;
let currentTheme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
let queue = Promise.resolve();
const pageSize = 30;
const sourceDefinitions = [
{kind:'forecast',meta:'forecast',label:'Egress forecast',name:'Egress Forcast Aug 18.csv',url:'/source/forecast.csv'},
{kind:'extension',meta:'extension',label:'MSA / extensions',name:'MSA_CAD_PAD_Forecast (1).xlsx',url:'/source/msa.xlsx'},
{kind:'inspection',meta:'inspections',label:'Inspection inquiry',name:'Inspection Inquiry Aug 18.csv',url:'/source/inspections.csv'}
];
const num = n => Number(n || 0).toLocaleString('en-US');
const dateLabel = iso => { if(!iso) return 'No date'; const d = new Date(String(iso).slice(0,10)+'T12:00:00'); return isNaN(d) ? 'Unknown date' : d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); };
const status = r => r.completed ? ['green','Reviewed'] : r.missingDue ? ['purple','Missing date'] : r.days < 0 ? ['red','Overdue'] : r.days <= 30 ? ['amber','Due soon'] : r.hasExtension ? ['blue','On extension'] : ['','Scheduled'];
const badge = r => {const s=status(r); return `<span class="em-badge ${s[0]}">${escape(s[1])}</span>`;};
const rowTitle = r => r.narrativeShort || r.narrative || r.pn || 'Unnamed item';
const needsReview = r => r.extensionReviewRequired || r.missingDue || r.tcPnVariance || r.tcIntervalVariance || r.extensionDisapproved;
function baseRows(){return S.records.filter(r => !r.hidden && (!S.filters.onStationOnly || r.onStation));}
function matchesBucket(r){
 if(bucket==='overdue') return !r.completed && r.days != null && r.days<0;
 if(bucket==='soon') return !r.completed && r.days != null && r.days>=0 && r.days<=30;
 if(bucket==='31-90') return !r.completed && r.days!=null && r.days>=31 && r.days<=90;
 if(bucket==='91-180') return !r.completed && r.days!=null && r.days>=91 && r.days<=180;
 if(bucket==='review') return needsReview(r);
 if(bucket==='hard') return !r.completed && E.isHardStop(r);
 if(bucket==='extensions') return r.hasExtension;
 if(bucket==='reviewed') return r.completed;
 if(bucket==='missing') return r.missingDue;
 return true;
}
function filteredRows(){
 E.updateDerivedViews();
 const result=S.filteredRecords.filter(matchesBucket);
 S.filteredRecords=result;
 return result;
}
function resetFilters(){S.selectedIds=[];S.filters={...E.defaultFilters(),onStationOnly:S.filters.onStationOnly};S.sort={key:'days',dir:'asc'};bucket='all';page=1;}
function toast(text,error=false){
 $('#em-toast')?.remove();const t=document.createElement('div');t.id='em-toast';t.className='em-toast'+(error?' error':'');t.role=error?'alert':'status';t.textContent=text;document.body.append(t);clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.remove(),6500);
}
function setTab(tab){currentTab=tab;page=1;render();window.scrollTo({top:0,behavior:'instant'});}
function openBucket(value){resetFilters();bucket=value;setTab('workboard');}
function activeFiltersCount(){return Number(!!S.filters.search)+S.filters.acft.length+Number(S.filters.recordKind!=='All')+Number(S.filters.itemType!=='All')+Number(!!S.filters.dateStart)+Number(!!S.filters.dateEnd)+Number(bucket!=='all');}
function tableMarkup(rows,overview=false){
 if(!rows.length) return `<div class="em-empty">${icon('search')}<strong>${S.records.length?'No matching items':'Your workboard is ready for data'}</strong><p>${S.records.length?'Try another search or clear the current filters.':'Load a forecast, inspection report, or the project source files.'}</p><button class="em-btn" data-action="${S.records.length?'clear-filters':'sources'}">${S.records.length?'Clear filters':'Load source files'}</button></div>`;
 return `<div class="em-table-wrap"><table class="em-table" aria-label="${overview?'Priority items':'Filtered workboard'}"><thead><tr><th>Aircraft</th><th>Item / component</th><th class="em-kind-col">Type</th><th>Due date</th><th>${overview?'Status':'Days'}</th><th>${overview?'':'Status'}</th></tr></thead><tbody>${rows.map(r=>`<tr><td><button class="em-tail" data-row="${escape(r.id)}" title="Open ${escape(r.acft)} ${escape(rowTitle(r))}">${escape(r.acft || 'Unknown')}</button><div class="em-code">${escape(r.wuc||r.jst||'—')}</div></td><td><button class="em-tail em-item" data-row="${escape(r.id)}" title="${escape(r.narrative)}">${escape(rowTitle(r))}</button><div class="em-code">P/N ${escape(r.pn||'—')} · S/N ${escape(r.sn||'—')}</div></td><td class="em-kind-col"><span class="em-badge ${r.recordKind==='Inspection'?'purple':''}">${r.recordKind==='Inspection'?'Inspection':'CAD/PAD'}</span></td><td>${escape(dateLabel(r.effectiveDueIso))}<div class="em-code">${r.hasExtension?'Extension applied':escape(r.effectiveDueSource||'Source date')}</div></td><td class="${!overview&&r.days<0?'em-days-red':''}">${overview?badge(r):r.days==null?'—':num(r.days)}</td><td>${overview?`<button class="em-text-btn" data-row="${escape(r.id)}" aria-label="View ${escape(r.acft)} ${escape(rowTitle(r))}">${icon('chevron')}</button>`:badge(r)}</td></tr>`).join('')}</tbody></table></div>`;
}
function snapshotBanner(){
 const stale=E.getStaleSourceFiles();
 if(!stale.length)return '';
 return `<div class="em-banner">${icon('clock')}<div><strong>Source refresh recommended.</strong> ${stale.length} source ${stale.length===1?'file is':'files are'} at least 7 days old. Due dates are calculated as of today.</div><button data-action="sources">Review sources →</button></div>`;
}
function overview(){
 const rows=baseRows(),open=rows.filter(r=>!r.completed),overdue=open.filter(r=>r.days!=null&&r.days<0),soon=open.filter(r=>r.days!=null&&r.days>=0&&r.days<=30),review=rows.filter(needsReview),hard=open.filter(E.isHardStop);
 const top=open.filter(r=>r.missingDue||r.days<=30||r.extensionReviewRequired).sort((a,b)=>(a.days??-Infinity)-(b.days??-Infinity)).slice(0,7);
 const horizon=[['Overdue',overdue.length,'overdue'],['0–30 days',soon.length,'soon'],['31–90 days',open.filter(r=>r.days>=31&&r.days<=90).length,'31-90'],['91–180 days',open.filter(r=>r.days>=91&&r.days<=180).length,'91-180']];
 const max=Math.max(...horizon.map(a=>a[1]),1);
 const reviewCounts=[['Extension evidence',rows.filter(r=>r.extensionReviewRequired).length,'Older, missing, or unapproved dates kept for review.'],['Reference differences',rows.filter(r=>r.tcPnVariance||r.tcIntervalVariance).length,'Part or interval differs from the embedded matrix.'],['Missing due dates',rows.filter(r=>r.missingDue).length,'Incomplete dates remain visible in the workboard.']];
 return `${snapshotBanner()}<div class="em-stats">
 <button class="em-stat red" data-bucket="overdue"><span class="em-stat-top">Overdue items<span class="em-stat-icon">${icon('alert')}</span></span><strong>${num(overdue.length)}</strong><small><i class="em-dot"></i>Past effective due date</small></button>
 <button class="em-stat amber" data-bucket="soon"><span class="em-stat-top">Due in 30 days<span class="em-stat-icon">${icon('calendar')}</span></span><strong>${num(soon.length)}</strong><small>Upcoming planned workload</small></button>
 <button class="em-stat" data-bucket="review"><span class="em-stat-top">Needs data review<span class="em-stat-icon">${icon('files')}</span></span><strong>${num(review.length)}</strong><small>Source gaps & discrepancies</small></button>
 <button class="em-stat" data-bucket="all"><span class="em-stat-top">${S.filters.onStationOnly?'On-station':'All'} records<span class="em-stat-icon">${icon('plane')}</span></span><strong>${num(rows.length)}</strong><small>${new Set(rows.map(r=>r.acft)).size} aircraft · ${num(rows.filter(r=>r.recordKind==='Inspection').length)} inspections</small></button>
 </div><div class="em-grid"><section class="em-panel"><div class="em-panel-head"><div><h2>Priority worklist <span class="em-count">${num(open.filter(r=>r.missingDue||r.days<=30||r.extensionReviewRequired).length)}</span></h2><p>Start with the items that need your attention.</p></div><button class="em-text-btn" data-bucket="all">View workboard →</button></div>${tableMarkup(top,true)}<div class="em-table-footer"><span>Earliest due first · ${S.filters.onStationOnly?'On station':'All aircraft'}</span><button class="em-text-btn" data-bucket="hard">${num(hard.length)} hard stops →</button></div></section>
 <div class="em-side-stack"><section class="em-panel"><div class="em-panel-head"><div><h2>Workload ahead</h2><p>Open records by effective due date</p></div>${icon('calendar')}</div><div class="em-chart">${horizon.map(([l,n,key])=>`<div class="em-chart-row"><button data-bucket="${key}">${l}</button><div class="em-bar" role="img" aria-label="${l}: ${n} items"><i style="width:${n/max*100}%"></i></div><b>${num(n)}</b></div>`).join('')}</div><div class="em-panel-foot">${num(open.filter(r=>r.days>180).length)} beyond 180 days · ${num(open.filter(r=>r.missingDue).length)} undated</div></section>
 <section class="em-panel"><div class="em-panel-head"><div><h2>Review queue</h2><p>Source evidence to resolve</p></div><button class="em-text-btn" data-action="sources">${icon('arrow')}</button></div><div class="em-review">${reviewCounts.filter(x=>x[1]>0).map(([l,n,d])=>`<div class="em-review-item">${icon('alert')}<div><strong>${num(n)} ${l.toLowerCase()}</strong><p>${d}</p></div></div>`).join('')||`<div class="em-review-item">${icon('check')}<div><strong>No review flags in this scope</strong><p>Full validation is available under Data & validation.</p></div></div>`}</div><div class="em-panel-foot">Source values preserved for traceability</div></section></div></div>`;
}
function workboard(){
 const rows=filteredRows(),pages=Math.max(1,Math.ceil(rows.length/pageSize));page=Math.min(page,pages);
 const tails=[...new Set(S.records.map(r=>r.acft).filter(Boolean))].sort();
 const chips=[['all','All items'],['overdue','Overdue'],['soon','Due in 30 days'],['hard','Hard stops'],['review','Data review'],['extensions','On extension'],['reviewed','Reviewed']];
 if(!chips.some(c=>c[0]===bucket))chips.push([bucket,bucket==='missing'?'Missing dates':bucket+' days']);
 return `<section class="em-panel"><div class="em-toolbar"><label class="em-search">${icon('search')}<input id="em-search" aria-label="Search records" placeholder="Search tail, WUC, part, serial or narrative…" value="${escape(S.filters.search)}" autocomplete="off"></label><select id="em-tail" aria-label="Aircraft"><option value="">All aircraft</option>${tails.map(t=>`<option ${S.filters.acft.includes(t)?'selected':''}>${escape(t)}</option>`).join('')}</select><select id="em-kind" aria-label="Record type"><option value="All">All record types</option><option ${S.filters.recordKind==='CAD/PAD'?'selected':''}>CAD/PAD</option><option ${S.filters.recordKind==='Inspection'?'selected':''}>Inspection</option></select><select id="em-sort" aria-label="Sort records"><option value="asc" ${S.sort.dir==='asc'?'selected':''}>Due: earliest first</option><option value="desc" ${S.sort.dir==='desc'?'selected':''}>Due: latest first</option></select></div>
 <div class="em-filter-row">${chips.map(([k,l])=>`<button class="em-chip ${bucket===k?'active':''}" data-filter="${k}" aria-pressed="${bucket===k}">${l}</button>`).join('')}<label class="em-toggle em-right"><input id="em-station" type="checkbox" ${S.filters.onStationOnly?'checked':''}>On station only</label></div>
 <div class="em-toolbar"><label class="em-field">From <input id="em-from" aria-label="Due date from" type="date" value="${escape(S.filters.dateStart)}"></label><label class="em-field">To <input id="em-to" aria-label="Due date to" type="date" value="${escape(S.filters.dateEnd)}"></label><select id="em-owner" aria-label="Workcenter scope"><option value="All">AFE & Egress</option><option ${S.filters.itemType==='Egress'?'selected':''}>Egress</option><option ${S.filters.itemType==='AFE'?'selected':''}>AFE</option></select><button class="em-text-btn em-right" data-action="clear-filters">Clear filters${activeFiltersCount()?` (${activeFiltersCount()})`:''}</button><button class="em-btn small" data-action="brief-csv">Daily brief CSV</button><button class="em-btn small" data-action="print">${icon('print')} Print brief</button></div>
 <div id="em-results">${workboardResults(rows,pages)}</div></section>`;
}
function workboardResults(rows,pages){return `${tableMarkup(rows.slice((page-1)*pageSize,page*pageSize))}<div class="em-table-footer"><span>${rows.length?num((page-1)*pageSize+1):0}–${num(Math.min(page*pageSize,rows.length))} of <strong>${num(rows.length)}</strong> records</span><div class="em-buttons"><button class="em-btn small" data-action="previous" ${page===1?'disabled':''}>Previous</button><span>${page} / ${pages}</span><button class="em-btn small" data-action="next" ${page===pages?'disabled':''}>Next</button></div></div>`;}
function dataPage(){
 const report=E.buildValidationReport(),counts=report.counts;
 return `<div class="em-source-grid">${sourceDefinitions.map(d=>{const m=S.fileMeta[d.meta];return `<section class="em-panel em-source-card"><header><h2>${d.label}</h2><span class="em-badge ${m?'green':''}">${m?'Loaded':'Not loaded'}</span></header><div class="em-source-file">${escape(m?.name||'Choose a source file to get started.')}</div><div class="em-source-num">${num(m?.count||0)}<small>parsed rows</small></div><div class="em-code">${m?'File modified '+dateLabel(m.lastModifiedIso || (Number.isFinite(Number(m.lastModified)) && Number(m.lastModified)>0 ? new Date(Number(m.lastModified)).toISOString() : m.loadedAt)):'.csv · .xlsx · .txt'}</div><button class="em-btn small" data-upload="${d.kind}">${icon('up')}${m?'Replace file':'Choose file'}</button></section>`;}).join('')}</div>
 <div class="em-drop" id="em-drop">${icon('up')}<p>Drop forecast, MSA, or inspection files here. Reports are matched to their source automatically.</p><button class="em-text-btn" data-action="choose-files">Choose multiple files</button></div>
 <section class="em-panel"><div class="em-panel-head"><div><h2>Validation & source coverage</h2><p>Full dataset · original dates and physical source rows retained</p></div><button class="em-btn small" data-action="validation-csv">${icon('download')} Export audit</button></div><div class="em-audit-summary"><div><strong>${num(counts.totalRows)}</strong><span>Scheduler records</span></div><div><strong>${num(counts.missingForecastCoverage+counts.missingInspectionCoverage)}</strong><span>Source rows missing after merge</span></div><div><strong>${num(counts.unmatchedExtensions)}</strong><span>Unresolved active MSA rows</span></div><div><strong>${num(counts.tctoRows)}</strong><span>TCTO reference rows</span></div></div>
 <div class="em-issues">${[...report.blockers,...report.issues].sort((a,b)=>({danger:0,warn:1,good:2}[a.severity])-({danger:0,warn:1,good:2}[b.severity])).map(i=>`<details><summary><span class="em-badge ${i.severity==='danger'?'red':i.severity==='warn'?'amber':'green'}">${i.severity==='danger'?'Review':i.severity==='warn'?'Check':'Passed'}</span>${escape(i.title)}</summary><p>${escape(i.detail)}</p></details>`).join('')}<details><summary>${icon('files')}Source sheet audit</summary><div class="em-table-wrap"><table class="em-table"><thead><tr><th>Sheet</th><th>Rows</th><th>Status</th><th>Reason</th></tr></thead><tbody>${S.sourceAudit.map(r=>`<tr><td>${escape(r.sheetName||r.sheet||'—')}</td><td>${num(r.rowCount)}</td><td>${escape(r.status||'—')}</td><td>${escape(r.reason||r.note||'—')}</td></tr>`).join('')}</tbody></table></div></details><details><summary>${icon('files')}TCTO reference records (${num(S.tctoRecords.length)})</summary><div class="em-table-wrap"><table class="em-table"><thead><tr><th>Aircraft</th><th>Reference</th></tr></thead><tbody>${S.tctoRecords.map(r=>`<tr><td>${escape(r.acft||'—')}</td><td>${escape(Object.entries(r).filter(([k,v])=>!['id','acft'].includes(k)&&v!=null&&typeof v!=='object').map(([k,v])=>k+': '+v).join(' · '))}</td></tr>`).join('')}</tbody></table></div></details></div></section>
 <section class="em-panel em-storage"><div><h3>Workspace backup</h3><p id="em-save-status">${saveStatus()}</p><label class="em-toggle" style="margin-top:11px"><input id="em-cache" type="checkbox" ${S.cacheEnabled?'checked':''}>Remember data and review marks in this browser</label></div><div class="em-buttons"><button class="em-btn small" data-action="backup-export">${icon('download')} Export backup</button><button class="em-btn small" data-action="backup-import">Import backup</button><button class="em-btn small" data-action="reload-project">${icon('refresh')} Reload project sources</button><button class="em-text-btn" data-action="clear-data">Clear browser data</button></div></section>`;
}
function saveStatus(){return !S.cacheEnabled?'Session only. Export a backup to carry your changes forward.':S.cacheSaveFailed?'Browser save failed. Export a backup before closing this page.':'Data and review marks are saved on this device; use backups to transfer between browsers.';}
function setTheme(theme){
 currentTheme=theme==='dark'?'dark':'light';
 document.documentElement.dataset.theme=currentTheme;
 try{localStorage.setItem('cadpad-theme',currentTheme);}catch{}
 render();
}
function render(){
 if(!E)return;
 const titles={overview:['Action dashboard','A clear view of what needs attention today.'],workboard:['Workboard','Search, prioritize, and review your egress workload.'],data:['Data & validation','Keep your sources current and every record accounted for.']};
 const [title,subtitle]=titles[currentTab];
 $('#em-app').innerHTML=`<div class="em-layout"><aside class="em-sidebar"><div class="em-brand"><div class="em-logo">${icon('plane')}</div><div><strong>CAD/PAD</strong><small>EGRESS MONITOR</small></div></div><div class="em-label">Workspace</div><nav class="em-nav" aria-label="Main navigation"><button data-tab="overview" class="${currentTab==='overview'?'active':''}" ${currentTab==='overview'?'aria-current="page"':''}>${icon('grid')}Overview</button><button data-tab="workboard" class="${currentTab==='workboard'?'active':''}" ${currentTab==='workboard'?'aria-current="page"':''}>${icon('list')}Workboard<span class="em-nav-count">${num(S.records.length)}</span></button><button data-tab="data" class="${currentTab==='data'?'active':''}" ${currentTab==='data'?'aria-current="page"':''}>${icon('files')}Data & validation</button></nav><div class="em-sidebar-bottom"><div class="em-local-card"><strong>${icon('shield')}Your private workspace</strong>File imports and review marks are processed in this browser.</div><div class="em-profile"><span class="em-avatar">EM</span><div>Egress maintenance<small>CAD/PAD monitoring</small></div></div></div></aside><main class="em-main"><header class="em-topbar"><div class="em-crumb">Workspace <span>/</span><b>${currentTab==='overview'?'Overview':title}</b></div><div class="em-topmeta"><time>${new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'})}</time><button class="em-theme-toggle" data-action="theme" aria-label="Switch to ${currentTheme==='dark'?'light':'dark'} mode" aria-pressed="${currentTheme==='dark'}" title="Switch to ${currentTheme==='dark'?'light':'dark'} mode">${icon(currentTheme==='dark'?'sun':'moon')}<span>${currentTheme==='dark'?'Light':'Dark'}</span></button><span class="em-private">${icon('lock')}Private</span></div></header><div class="em-content"><div class="em-pagehead"><div><p class="em-eyebrow">${currentTab==='overview'?'Maintenance at a glance':'Egress monitor'}</p><h1>${title}</h1><p class="em-subtitle">${subtitle}</p></div><div class="em-buttons">${currentTab==='overview'?`<button class="em-btn" data-action="brief">${icon('download')}Daily brief</button><button class="em-btn primary" data-tab="workboard">Open workboard ${icon('arrow')}</button>`:currentTab==='workboard'?`<button class="em-btn" data-action="sources">${icon('up')}Update sources</button><button class="em-btn primary" data-action="export">${icon('download')}Export view</button>`:`<button class="em-btn primary" data-action="choose-files">${icon('up')}Import files</button>`}</div></div>${loading?'<div class="em-loading"><div class="em-spinner"></div><span>Reading your project source files…</span></div>':currentTab==='overview'?overview():currentTab==='workboard'?workboard():dataPage()}<footer class="em-bottomline"><div class="em-source-strip">${sourceDefinitions.map(d=>`<span><i style="background:${S.fileMeta[d.meta]?'#75a48a':'#c6cdd7'}"></i>${d.kind==='extension'?'MSA':d.kind==='inspection'?'Inspections':'Forecast'}</span>`).join('')}</div><span>Planning & review aid · Verify against current maintenance records</span></footer></div></main></div>`;
 bindInputs();
}
function refreshResults(){
 const rows=filteredRows();page=1;const target=$('#em-results');if(target)target.innerHTML=workboardResults(rows,Math.max(1,Math.ceil(rows.length/pageSize)));
}
function bindInputs(){
 $('#em-search')?.addEventListener('input',e=>{S.filters.search=e.target.value;refreshResults();});
 [['em-tail','acft',v=>v?[v]:[]],['em-kind','recordKind'],['em-owner','itemType'],['em-from','dateStart'],['em-to','dateEnd']].forEach(([id,key,fn])=>$('#'+id)?.addEventListener('change',e=>{S.filters[key]=fn?fn(e.target.value):e.target.value;if(S.filters.dateStart&&S.filters.dateEnd&&S.filters.dateStart>S.filters.dateEnd){S.filters[key]='';e.target.value='';toast('The start date must be on or before the end date.',true);}page=1;render();}));
 $('#em-sort')?.addEventListener('change',e=>{S.sort={key:'days',dir:e.target.value};page=1;render();});
 $('#em-station')?.addEventListener('change',e=>{S.filters.onStationOnly=e.target.checked;page=1;render();});
 $('#em-cache')?.addEventListener('change',e=>{S.cacheEnabled=e.target.checked;E.persistState();render();toast(S.cacheEnabled?saveStatus():'Browser restore cache disabled. Your current session remains open.');});
 const drop=$('#em-drop');if(drop){['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('drag');}));drop.addEventListener('dragleave',()=>drop.classList.remove('drag'));drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('drag');enqueueImport(Array.from(e.dataTransfer.files));});}
}
// Keep native pickers outside the redrawn workspace. Returning from an OS
// picker fires focus/visibility events before change in some browsers.
function initFileInputs(){
 const host=document.createElement('div');
 host.id='em-file-inputs';
 host.innerHTML=`${sourceDefinitions.map(d=>`<input class="em-hidden" id="em-file-${d.kind}" type="file" accept=".csv,.xlsx,.txt" aria-label="Upload ${d.label}">`).join('')}<input id="em-multi" class="em-hidden" type="file" accept=".csv,.xlsx,.txt" multiple aria-label="Import multiple source files"><input id="em-backup" class="em-hidden" type="file" accept=".json" aria-label="Import backup file">`;
 document.body.append(host);
 const takeFiles=input=>{const files=Array.from(input.files||[]);input.value='';return files;};
 sourceDefinitions.forEach(d=>$('#em-file-'+d.kind).addEventListener('change',e=>{
  const files=takeFiles(e.currentTarget);if(files.length)enqueueImport(files,d.kind);
 }));
 $('#em-multi').addEventListener('change',e=>enqueueImport(takeFiles(e.currentTarget)));
 $('#em-backup').addEventListener('change',e=>{
  const [file]=takeFiles(e.currentTarget);if(!file)return;
  queue=queue.then(async()=>{
   await E.importDatasetBackup(file);loading=false;resetFilters();render();
   toast(S.statusMessage,/Could not|failed|invalid/i.test(S.statusMessage));
  }).catch(err=>{toast('Import could not finish: '+err.message,true);loading=false;render();});
 });
}
async function enqueueImport(files,kind){
 if(!files.length)return;
 queue=queue.then(async()=>{
 for(const f of files){
 if(f.size>30*1024*1024){toast(f.name+' exceeds the 30 MB import limit.',true);continue;}
 if(!/\.(csv|txt|xlsx)$/i.test(f.name)){toast('Choose a CSV, TXT, or XLSX file.',true);continue;}
 toast('Reading '+f.name+'…');
 if(kind)await E.handleFileInput(kind,f);else await E.routeDroppedFiles([f]);
 const failed=/Could not|failed|no usable|couldn.t/i.test(S.statusMessage);
 toast(S.statusMessage,failed);
 }
 resetFilters();loading=false;render();
 if(S.cacheSaveFailed)toast('Files loaded, but browser storage is full. Export a backup before closing.',true);
 }).catch(err=>{toast('Import could not finish: '+err.message,true);loading=false;render();});
 return queue;
}
async function loadProject(){
 loading=true;render();
 try{
 // Retain the real report timestamp. Serving a file today must not imply fresh source data.
 const files=[];
 for(const d of sourceDefinitions){const response=await fetch(d.url,{cache:'no-store'});if(!response.ok)throw Error('Cannot read '+d.name);files.push([d,new File([await response.arrayBuffer()],d.name,{lastModified:Date.UTC(2026,7,18)})]);}
 for(const [d,f] of files)await E.handleFileInput(d.kind,f);
 resetFilters();loading=false;render();
 if(S.records.length)toast('Project files loaded. Review source age and validation before scheduling.');
 else throw Error('No usable records were loaded.');
 }catch(err){loading=false;render();toast(err.message+' You can import the source files directly.',true);}
}
function syncExportScope(){if(currentTab==='overview'){const keep=S.filters;S.filters={...E.defaultFilters(),onStationOnly:keep.onStationOnly};E.updateDerivedViews();S.filters=keep;}else filteredRows();}
function detail(id){
 const r=S.records.find(x=>x.id===id);if(!r)return;
 selectedId=id;lastFocus=document.activeElement;
 S.selectedIds=[id];
 const dl=items=>`<dl class="em-detail-grid">${items.map(([k,v])=>`<div><dt>${escape(k)}</dt><dd>${escape(v??'—')||'—'}</dd></div>`).join('')}</dl>`;
 const html=`<div class="em-dialog-head"><div><span class="em-badge blue">${escape(r.acft)} · ${escape(r.recordKind)}</span><h2>${escape(rowTitle(r))}</h2><p>${escape(r.narrative)}</p></div><button class="em-close" data-action="close-dialog" aria-label="Close record">${icon('close')}</button></div><div class="em-dialog-body">${badge(r)} ${r.noFurtherExtension?'<span class="em-badge red">No further extension</span>':''}${dl([['Effective due date',dateLabel(r.effectiveDueIso)],['Days remaining',r.days==null?'Unknown':num(r.days)],['Part number',r.pn],['Serial number',r.sn],['WUC / JST',[r.wuc,r.jst].filter(Boolean).join(' / ')],['Interval',r.intervalDisplay],['Workcenter',r.itemType],['Station status',r.stationStatus]])}
 <div class="em-detail-block"><strong>Due-date evidence</strong>${dl([['Original source date',dateLabel(r.originalDueIso)],['Effective date source',r.effectiveDueSource],['Proposed / extension date',r.extensionDateText||r.extensionDateIso],['Extension status',r.extensionStatusText||'No extension evidence'],['Matching',r.extensionMatchType],['Supply / requisition',[r.supplyOnHand,r.requisitionStatus].filter(Boolean).join(' · ')],['MSA evidence',[r.extensionSourceName,r.extensionSourceSheet,r.extensionSourceRow?'Row '+r.extensionSourceRow:''].filter(Boolean).join(' · ')]])}${r.extensionReviewRequired?'<span class="em-badge amber">Extension evidence needs review</span>':''}${r.extensionDateConflict?'<p>An MSA date precedes the current source due date. The current source date is retained.</p>':''}</div>
 <div class="em-detail-block"><strong>Source traceability</strong>${escape(r.sourceName)}<br>${escape(r.sheetName)} · physical row ${escape(r.rowIndex)}${r.inspectionEnrichmentSource?'<p>Inspection context: '+escape(r.inspectionEnrichmentSource)+'</p>':''}</div>
 ${r.tcMatrixMatched?`<div class="em-detail-block"><strong>Time Change Matrix reference</strong>${escape(r.tcNounRef||r.tcAssembly)}${dl([['Matrix part reference',r.tcPartRef],['Matrix row',r.tcMatrixRow],['Part variance',r.tcPnVariance?'Review required':'No variance flagged'],['Interval variance',r.tcIntervalVariance?'Review required':'No variance flagged']])}</div>`:''}
 <p style="font-size:10px;color:#8d99aa">Review marks are personal tracking annotations. They do not change the source due date or certify maintenance completion.</p></div><div class="em-dialog-actions"><button class="em-btn primary" data-action="mark-reviewed">${icon('check')}${r.completed?'Reopen review':'Mark reviewed'}</button><button class="em-btn" data-action="flag-extension">${icon('flag')}${r.manualNoFurtherExtension?'Remove manual flag':'Flag no further extension'}</button><button class="em-btn" data-action="binder">${icon('print')}Aircraft binder</button></div>`;
 showDialog(html);
}
function showDialog(html){let d=$('#em-dialog');if(!d){d=document.createElement('dialog');d.id='em-dialog';d.setAttribute('aria-label','Record details');document.body.append(d);d.addEventListener('click',e=>{if(e.target===d){const b=d.getBoundingClientRect();if(e.clientX<b.left||e.clientX>b.right||e.clientY<b.top||e.clientY>b.bottom)closeDialog();}});d.addEventListener('close',()=>lastFocus?.isConnected&&lastFocus.focus());}d.innerHTML=html;if(!d.open)d.showModal();}
function closeDialog(){$('#em-dialog')?.close();selectedId=null;}
function confirmation(title,copy,action,label){lastFocus=document.activeElement;showDialog(`<div class="em-dialog-head"><div><h2>${escape(title)}</h2></div><button class="em-close" data-action="close-dialog" aria-label="Close">${icon('close')}</button></div><div class="em-dialog-body"><p style="font-size:13px;color:#71839b">${escape(copy)}</p></div><div class="em-dialog-actions"><button class="em-btn primary" data-action="${action}">${escape(label)}</button><button class="em-btn" data-action="close-dialog">Cancel</button></div>`);}
function handleClick(e){
 const button=e.target.closest('button');if(!button)return;
 if(button.dataset.tab){setTab(button.dataset.tab);return;}
 if(button.dataset.bucket){openBucket(button.dataset.bucket);return;}
 if(button.dataset.filter){bucket=button.dataset.filter;page=1;render();return;}
 if(button.dataset.row){detail(button.dataset.row);return;}
 if(button.dataset.upload){$('#em-file-'+button.dataset.upload)?.click();return;}
 const action=button.dataset.action;
 if(action==='theme'){setTheme(currentTheme==='dark'?'light':'dark');return;}
 if(action==='sources')setTab('data');
 if(action==='clear-filters'){resetFilters();render();}
 if(action==='export'){syncExportScope();E.exportFilteredCsv();toast('Exported every record in the current view.');}
 if(action==='brief'||action==='brief-csv'){syncExportScope();E.exportDailyBriefCsv();toast('Daily brief exported for the current scope.');}
 if(action==='print'){syncExportScope();E.printDailyBrief();}
 if(action==='validation-csv')E.exportValidationCsv();
 if(action==='next'){page++;render();$('#em-results')?.scrollIntoView({block:'start'});}
 if(action==='previous'){page=Math.max(1,page-1);render();$('#em-results')?.scrollIntoView({block:'start'});}
 if(action==='choose-files'){if(currentTab!=='data')setTab('data');$('#em-multi')?.click();}
 if(action==='backup-export'){E.exportDatasetBackup();toast('Backup exported with source data and review marks.');}
 if(action==='backup-import')$('#em-backup')?.click();
 if(action==='reload-project')confirmation('Reload project sources?','This replaces the three current source files with the beta-test project reports. Review marks remain on uniquely matched unchanged items. Export a backup first if you need the current dataset.','confirm-reload','Reload project files');
 if(action==='confirm-reload'){closeDialog();loadProject();}
 if(action==='clear-data')confirmation('Clear browser data?','This removes the current dataset and its review marks from this browser. Export a backup before clearing if you want to retain your changes. The hosted project source files remain available to reload.','confirm-clear','Clear browser data');
 if(action==='confirm-clear'){closeDialog();E.clearCache();bucket='all';try{localStorage.setItem('egress-user-cleared','1');}catch{}render();toast('Browser data cleared. Import files or reload project sources when ready.');}
 if(action==='close-dialog')closeDialog();
 if(action==='mark-reviewed'||action==='flag-extension'){const id=selectedId;S.selectedIds=[id];E.applyRowAction(action==='mark-reviewed'?'completed':'noFurtherExtension');render();detail(id);toast(action==='mark-reviewed'?'Review mark updated. Source dates are unchanged.':'Manual extension flag updated.');}
 if(action==='binder'){const id=selectedId;$('#em-dialog')?.close();const row=S.records.find(r=>r.id===id);const savedAircraft=S.filters.acft;S.filters.acft=row?[row.acft]:[];S.selectedIds=[id];try{E.printAircraftBinderSheet();}finally{S.filters.acft=savedAircraft;}}
}
async function init(){
 E=window.EgressEngine;S=E.state;
 initFileInputs();
 // Preserve the release-17 print engine while keeping its previous screen layout out of the new UI.
 document.body.append(E.el.printArea);
 document.addEventListener('click',e=>{if(e.target.closest('#em-app,#em-dialog'))handleClick(e);});
 const previous=E.refreshCalendarDay;
 window.addEventListener('focus',()=>{previous();if(!loading)render();});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden){previous();if(!loading)render();}});
 setInterval(()=>{previous();if(!loading&&currentTab==='overview')render();},60000);
 resetFilters();
 let cleared=false;try{cleared=localStorage.getItem('egress-user-cleared')==='1';}catch{}
 if(S.records.length){loading=false;render();}else if(cleared){loading=false;currentTab='data';render();}else await loadProject();
 window.CADPAD_UI={get tab(){return currentTab;},get bucket(){return bucket;},get loading(){return loading;},filteredRows,render,setTab,loadProject,enqueueImport};
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
