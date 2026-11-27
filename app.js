const SUPABASE_URL = window.DISHA_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.DISHA_SUPABASE_ANON_KEY || '';
const $ = (s)=>document.querySelector(s);
let client=null, profile=null, students=[], attendance=[], staffMembers=[];
const labels={parentDashboard:['Parent dashboard','Your child’s school updates'],dashboard:['Dashboard','Your school at a glance'],students:['Students','Student records and Excel tools'],attendance:['Attendance','Daily class attendance'],dailyRecords:['Daily child records','Individual daily learning and care notes'],timetableManage:['Class timetable','Edit schedules for all classes'],fees:['Fees & payments','Track student payments'],operations:['School records','Additional school operations'],users:['Staff access','Manage authorized school accounts'],settings:['Settings & backup','Connection and data safety']};
const onlineReady=()=>!!client;
const localDateString=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
function msg(t){$('#syncStatus').textContent=t;}
function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function show(view){if(profile?.role==='parent'&&view!=='parentDashboard')view='parentDashboard';if(profile?.role!=='parent'&&view==='parentDashboard')view='dashboard';if(profile?.role!=='admin'&&['users'].includes(view))view='dashboard';document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==view);document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('#heading').textContent=labels[view][0];$('#subheading').textContent=labels[view][1];if(view==='students')renderStudents();if(view==='attendance')renderAttendance();if(view==='dailyRecords')loadDailyRecords();if(view==='timetableManage')loadTimetable();if(view==='fees')loadFees();if(view==='dashboard')renderDashboard();if(view==='parentDashboard')loadParentDashboard();if(view==='users')loadStaffDirectory();}
function localQueue(){return JSON.parse(localStorage.getItem('dishaPending')||'[]')}
function queue(op,table,row){const q=localQueue();q.push({op,table,row,created_at:new Date().toISOString()});localStorage.setItem('dishaPending',JSON.stringify(q));msg('Saved on this device. It will sync when internet returns.');}
async function syncQueue(){if(!client||!navigator.onLine)return;let q=localQueue(),left=[];for(const item of q){let {error}=item.op==='upsert'?await client.from(item.table).upsert(item.row,{onConflict:item.table==='students'?'admission_no':'student_id,attendance_date'}):await client.from(item.table).insert(item.row);if(error){left.push(item);console.error(error)}}localStorage.setItem('dishaPending',JSON.stringify(left));msg(left.length?`${left.length} item(s) still need syncing. Check connection or permissions.`:'All pending changes synced.');if(!left.length)await loadStudents();}
async function init(){if(!SUPABASE_URL||!SUPABASE_ANON_KEY||!window.supabase){$('#authMsg').textContent='Setup required: add your Supabase URL and publishable/anon key in config.js.';return;}client=window.supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
$('#connection').textContent=navigator.onLine?'Connected to app service':'Offline';
client.auth.onAuthStateChange((event, session)=>{
  if(event==='PASSWORD_RECOVERY'){
    showPasswordReset();
  }
});
const {data:{session}}=await client.auth.getSession();
if(session && !location.hash.includes('type=recovery')) await enterApp();}
async function enterApp(){const {data:{session}}=await client.auth.getSession();const user=session?.user;if(!user)return;let data=null,error=null;if(navigator.onLine){({data,error}=await client.from('profiles').select('display_name,role').eq('id',user.id).single());if(!error)localStorage.setItem('dishaProfileCache',JSON.stringify({...data,email:user.email,id:user.id}));}else{data=JSON.parse(localStorage.getItem('dishaProfileCache')||'null');if(!data)error={message:'First sign-in and profile sync require internet.'};}if(error){$('#authMsg').textContent='Your account profile is unavailable. Connect to the internet or ask the school Admin to complete staff setup.';return;}profile={...data,email:user.email,id:user.id};$('#login').hidden=true;$('#app').hidden=false;$('#role').textContent=profile.role.toUpperCase();document.querySelectorAll('.admin-only').forEach(x=>x.hidden=profile.role!=='admin');document.querySelectorAll('.staff-only').forEach(x=>x.hidden=profile.role==='parent');document.querySelectorAll('.parent-only').forEach(x=>x.hidden=profile.role!=='parent');if(profile.role==='parent'){show('parentDashboard');return;}await syncQueue();await loadStudents();show('dashboard');}
// Parent portal: all child data is fetched through restricted SECURITY DEFINER RPCs.
async function parentRpc(name, studentId){
  const {data,error}=await client.rpc(name,{p_student_id:studentId});
  if(error)throw error;
  return data||[];
}
function parentRows(title, rows, fields, emptyText){
  if(!rows.length)return `<section class="parent-card"><h3>${esc(title)}</h3><p class="muted">${esc(emptyText)}</p></section>`;
  return `<section class="parent-card"><h3>${esc(title)}</h3><div class="parent-table-wrap"><table><thead><tr>${fields.map(f=>`<th>${esc(f.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${fields.map(f=>`<td>${esc(r[f.key]??'—')}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}

function renderWeeklyReports(reports=[]){
  if(!reports.length)return `<section class="parent-card"><h3>📬 Weekly reports</h3><p class="muted">Your Friday report will appear here when it is generated by the school.</p></section>`;
  const latest=reports[0],current=localDateString();
  const isCurrent=latest.week_start<=current&&latest.week_end>=current;
  const data=latest.report_data||{};
  const demo=latest.is_demo?' · DEMO / TEST DATA':'';
  const daily=Array.isArray(data.daily_records)?data.daily_records:[];
  const content=daily.map(d=>`<li><b>${esc(d.date||'')}</b> — ${esc(d.learning_topics||'')}${d.activities?' · '+esc(d.activities):''}${d.teacher_notes?' · Note: '+esc(d.teacher_notes):''}</li>`).join('');
  return `<section class="parent-card weekly-report"><h3>📬 Weekly reports</h3>${isCurrent?'<p class="notice"><b>🎉 This week’s report is ready!</b> Open it below.</p>':''}<p><b>${esc(latest.week_start)} to ${esc(latest.week_end)}</b>${esc(demo)}</p><details ${isCurrent?'open':''}><summary>View weekly report</summary><p><b>Attendance</b></p><ul>${(data.attendance||[]).map(a=>`<li>${esc(a.date||'')} — ${esc(a.status||'')}</li>`).join('')||'<li>No attendance records for this week.</li>'}</ul><p><b>Daily learning & activities</b></p><ul>${content||'<li>No daily notes were saved for this week.</li>'}</ul><p><b>Learning progress</b></p><ul>${(data.progress||[]).map(p=>`<li>${esc(p.date||'')} — ${esc(p.domain||'')}: ${esc(p.note||'')}</li>`).join('')||'<li>No progress updates this week.</li>'}</ul><p><b>Montessori observations</b></p><ul>${(data.observations||[]).map(o=>`<li>${esc(o.date||'')} — ${esc(o.area||'')}: ${esc(o.activity||'')} · ${esc(o.observation||'')} (${esc(o.level||'')})</li>`).join('')||'<li>No Montessori observations this week.</li>'}</ul></details>${reports.length>1?`<details><summary>Previous reports (${reports.length-1})</summary>${reports.slice(1).map(r=>{const d=r.report_data||{};return `<details><summary>${esc(r.week_start)} to ${esc(r.week_end)}${r.is_demo?' · DEMO':''}</summary><p><b>Attendance:</b> ${(d.attendance||[]).length} record(s)</p><ul>${(d.daily_records||[]).map(x=>`<li>${esc(x.date||'')} — ${esc(x.learning_topics||'')}${x.activities?' · '+esc(x.activities):''}${x.teacher_notes?' · '+esc(x.teacher_notes):''}</li>`).join('')||'<li>No daily notes.</li>'}</ul><p><b>Progress:</b> ${(d.progress||[]).length} update(s) · <b>Observations:</b> ${(d.observations||[]).length}</p></details>`;}).join('')}</details>`:''}</section>`;
}

function weeklyReportReadyInMarkup(host){
  return !!host.querySelector('.weekly-report .notice');
}
function showWeeklyPopup(){
  if(document.getElementById('weeklyReportPopup'))return;
  const modal=document.createElement('div');modal.id='weeklyReportPopup';modal.className='modal';
  modal.innerHTML=`<div class="modal-card"><div class="panel-head"><h2>🎉 Friday weekly report</h2><button class="soft" type="button" id="closeWeeklyPopup">✕</button></div><p>Your child’s weekly report is ready. You can view it in the Weekly reports section and revisit previous reports any time.</p><button class="primary" id="openWeeklyReport">View weekly report</button></div>`;
  document.body.appendChild(modal);modal.hidden=false;
  $('#closeWeeklyPopup').onclick=()=>modal.remove();
  $('#openWeeklyReport').onclick=()=>{modal.remove();document.querySelector('.weekly-report')?.scrollIntoView({behavior:'smooth',block:'center'});};
}

async function loadParentDashboard(){
  const host=$('#parentChildren'),notice=$('#parentMessage');
  host.innerHTML='<p class="muted">Loading your child’s records…</p>';notice.textContent='';
  if(!navigator.onLine){host.innerHTML='<p class="notice">Connect to the internet to view the latest school information.</p>';return;}
  try{
    const {data:children,error}=await client.rpc('get_my_linked_children');
    if(error)throw error;
    if(!children?.length){host.innerHTML='<section class="parent-card"><h3>No child linked yet</h3><p>Please contact Disha Preschool Admin and ask them to link your parent login to your child’s admission record.</p></section>';return;}
    const cards=await Promise.all(children.map(async child=>{
      const [attendance,progress,observations,fees,daycare,timetable,photoPathRows,weeklyReports]=await Promise.all([
        parentRpc('get_my_child_attendance',child.student_id),
        parentRpc('get_my_child_progress',child.student_id),
        parentRpc('get_my_child_observations',child.student_id),
        parentRpc('get_my_child_fees',child.student_id),
        parentRpc('get_my_child_daycare',child.student_id),
        parentRpc('get_my_child_timetable',child.student_id),
        parentRpc('get_my_child_photo_path',child.student_id),
        parentRpc('get_my_child_weekly_reports',child.student_id)
      ]);
      const photoUrl=await studentPhotoUrl(photoPathRows[0]?.photo_path);
      const photo=photoUrl?`<img class="parent-child-photo" src="${esc(photoUrl)}" alt="${esc(child.full_name)}">`:'<div class="parent-child-placeholder">🧒</div>';
      const details=[['Admission number',child.admission_no],['Class',child.class_name],['Date of birth',child.date_of_birth],['Status',child.status]].filter(x=>x[1]);
      return `<article class="parent-child"><div class="parent-child-head">${photo}<div><h2>${esc(child.full_name)}</h2><p>${esc(child.class_name||'Class not set')} · ${esc(child.admission_no||'')}</p></div></div><div class="parent-details">${details.map(x=>`<div><small>${esc(x[0])}</small><b>${esc(x[1])}</b></div>`).join('')}</div>
      ${parentRows('Attendance',attendance,[{key:'attendance_date',label:'Date'},{key:'status',label:'Status'}],'No attendance records available yet')}
      ${parentRows('Child progress',progress,[{key:'recorded_on',label:'Date'},{key:'domain',label:'Learning area'},{key:'note',label:'Update'}],'No progress updates available yet')}
      ${parentRows('Montessori observations',observations,[{key:'observed_on',label:'Date'},{key:'learning_area',label:'Learning area'},{key:'activity',label:'Activity'},{key:'observation',label:'Observation'},{key:'progress_level',label:'Progress'}],'No observations available yet')}
      ${parentRows('Fee payments',fees,[{key:'payment_date',label:'Payment date'},{key:'fee_month',label:'Fee month'},{key:'amount',label:'Amount (₹)'},{key:'payment_mode',label:'Mode'}],'No payment records available yet')}
      ${parentRows('Daycare',daycare,[{key:'record_date',label:'Date'},{key:'check_in',label:'Check-in'},{key:'check_out',label:'Check-out'}],'No daycare records available yet')}
      ${parentRows('Class timetable',timetable,[{key:'weekday',label:'Day'},{key:'start_time',label:'From'},{key:'end_time',label:'To'},{key:'activity',label:'Activity'}],'No timetable published yet')}
      ${renderWeeklyReports(weeklyReports)}
      </article>`;
    }));
    host.innerHTML=cards.join('');
    const today=new Date();
    if(today.getDay()===5){
      if(weeklyReportReadyInMarkup(host)) showWeeklyPopup();
    }
  }catch(error){
    console.error('Parent dashboard error:',error);
    host.innerHTML='<section class="parent-card"><h3>Could not load your child’s information</h3><p>Please check the parent access SQL setup and contact the school Admin if the issue continues.</p></section>';
    notice.textContent=error.message||'Parent dashboard could not be loaded.';
  }
}

$('#loginForm').addEventListener('submit',async e=>{e.preventDefault();if(!client){$('#authMsg').textContent='Complete Supabase setup first (see SETUP.md).';return;}const f=new FormData(e.target);$('#authMsg').textContent='Signing in…';const {error}=await client.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});if(error){$('#authMsg').textContent=error.message;return;}await enterApp();});
function showPasswordReset(message=''){
  $('#loginForm').hidden=true;
  $('#resetPasswordForm').hidden=false;
  $('#app').hidden=true;
  $('#login').hidden=false;
  $('#resetMsg').textContent=message || 'Enter and confirm your new password below.';
}
function showLogin(message=''){
  $('#resetPasswordForm').hidden=true;
  $('#loginForm').hidden=false;
  $('#login').hidden=false;
  $('#app').hidden=true;
  $('#authMsg').textContent=message;
  $('#resetMsg').textContent='';
}
$('#forgot').onclick=async()=>{
  if(!client){$('#authMsg').textContent='Complete Supabase setup first.';return;}
  const email=$('#loginForm [name=email]').value.trim();
  if(!email){$('#authMsg').textContent='Enter your registered email address first.';return;}
  $('#authMsg').textContent='Sending password reset email…';
  const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin + '/'});
  $('#authMsg').textContent=error?('Could not send reset email: '+error.message):'Password reset email sent. Open the newest email link on this device. The link can only be used once.';
};
$('#resetPasswordForm').addEventListener('submit',async e=>{
  e.preventDefault();
  if(!client){$('#resetMsg').textContent='Supabase is not connected.';return;}
  const f=new FormData(e.currentTarget);
  const password=String(f.get('password')||'');
  const confirmPassword=String(f.get('confirmPassword')||'');
  if(password.length<8){$('#resetMsg').textContent='Your password must contain at least 8 characters.';return;}
  if(password!==confirmPassword){$('#resetMsg').textContent='The passwords do not match. Please try again.';return;}
  const button=$('#saveNewPassword');
  button.disabled=true;button.textContent='Saving…';$('#resetMsg').textContent='Updating your password securely…';
  const {error}=await client.auth.updateUser({password});
  button.disabled=false;button.textContent='Save new password';
  if(error){$('#resetMsg').textContent='Password was not updated: '+error.message;return;}
  await client.auth.signOut();
  history.replaceState(null,'',location.pathname+location.search);
  e.currentTarget.reset();
  showLogin('Your password has been updated successfully. Please sign in using your new password.');
});
$('#logout').onclick=async()=>{await client?.auth.signOut();profile=null;$('#app').hidden=true;$('#login').hidden=false;};
$('#changePassword').onclick=async()=>{if(!client)return;const p=prompt('Enter a new password (minimum 8 characters):');if(!p)return;if(p.length<8){alert('Use at least 8 characters.');return;}const {error}=await client.auth.updateUser({password:p});alert(error?error.message:'Password updated.');};
document.querySelectorAll('.nav').forEach(b=>b.onclick=()=>show(b.dataset.view));document.querySelectorAll('[data-go]').forEach(b=>b.onclick=()=>show(b.dataset.go));
async function loadStudents(){if(!client)return;if(!navigator.onLine){students=JSON.parse(localStorage.getItem('dishaStudentCache')||'[]');renderStudents();renderDashboard();return;}const {data,error}=await client.from('students').select('*').order('created_at',{ascending:false});if(error){students=JSON.parse(localStorage.getItem('dishaStudentCache')||'[]');msg('Could not refresh students: '+error.message);renderStudents();renderDashboard();return;}students=data||[];localStorage.setItem('dishaStudentCache',JSON.stringify(students));renderStudents();renderDashboard();}
function renderDashboard(){const active=students.filter(s=>s.status==='Active').length;$('#stats').innerHTML=[['🧒','Total students',students.length],['🌟','Active students',active],['📥','Offline items waiting',localQueue().length]].map(x=>`<div class="stat"><small>${x[0]} ${x[1]}</small><strong>${x[2]}</strong></div>`).join('');$('#recent').innerHTML=students.slice(0,6).length?table(students.slice(0,6),['admission_no','full_name','class_name','guardian_name','status']):'<p class="muted">No student records yet. Add a student or import an Excel file.</p>';}
function table(rows,cols){if(!rows.length)return '<p class="muted">No records found.</p>';return `<table><thead><tr>${cols.map(c=>`<th>${esc(c.replaceAll('_',' '))}</th>`).join('')}<th>Action</th></tr></thead><tbody>${rows.map(r=>`<tr>${cols.map(c=>`<td>${esc(r[c]??'')}</td>`).join('')}<td><button class="soft" data-edit="${esc(r.id)}">Edit</button></td></tr>`).join('')}</tbody></table>`;}
async function studentPhotoUrl(path){
  if(!path||!client||!navigator.onLine)return '';
  const {data,error}=await client.storage.from('student-photos').createSignedUrl(path,3600);
  if(error){console.warn('Could not create student photo URL:',error.message);return '';}
  return data?.signedUrl||'';
}
async function renderStudents(){
  const q=($('#search')?.value||'').toLowerCase(),cl=$('#classFilter')?.value||'';
  const rows=students.filter(s=>(!cl||s.class_name===cl)&&[s.full_name,s.admission_no,s.guardian_name,s.guardian_phone].some(v=>String(v||'').toLowerCase().includes(q)));
  if(!rows.length){$('#studentTable').innerHTML='<p class="muted">No records found.</p>';return;}
  const photoUrls=await Promise.all(rows.map(s=>studentPhotoUrl(s.photo_path)));
  $('#studentTable').innerHTML=`<table><thead><tr><th>Photo</th><th>Admission no.</th><th>Student</th><th>Class</th><th>Parent</th><th>Phone</th><th>Status</th><th>Action</th></tr></thead><tbody>${rows.map((r,i)=>`<tr><td>${photoUrls[i]?`<img class="student-thumb" src="${esc(photoUrls[i])}" alt="${esc(r.full_name)}">`:'<span class="photo-placeholder">👧</span>'}</td><td>${esc(r.admission_no)}</td><td>${esc(r.full_name)}</td><td>${esc(r.class_name)}</td><td>${esc(r.guardian_name)}</td><td>${esc(r.guardian_phone)}</td><td>${esc(r.status)}</td><td><button class="soft" data-edit="${esc(r.id)}">Edit</button></td></tr>`).join('')}</tbody></table>`;
  document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editStudent(b.dataset.edit));
}
$('#search').oninput=renderStudents;$('#classFilter').onchange=renderStudents;
async function openStudent(s={}){
  const f=$('#studentForm');f.reset();
  for(const [k,v] of Object.entries(s))if(f.elements[k]&&f.elements[k].type!=='file')f.elements[k].value=v??'';
  const preview=$('#studentPhotoPreview');preview.hidden=true;preview.removeAttribute('src');
  if(s.photo_path){const url=await studentPhotoUrl(s.photo_path);if(url){preview.src=url;preview.hidden=false;}}
  $('#modalTitle').textContent=s.id?'Edit student':'Add student';$('#modal').hidden=false;
}
$('#studentPhoto').onchange=e=>{
  const file=e.target.files?.[0],preview=$('#studentPhotoPreview');
  if(!file){preview.hidden=true;preview.removeAttribute('src');return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){alert('Choose a JPG, PNG or WEBP image.');e.target.value='';preview.hidden=true;return;}
  if(file.size>2*1024*1024){alert('Photo must be 2 MB or smaller.');e.target.value='';preview.hidden=true;return;}
  if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);
  preview.dataset.objectUrl=URL.createObjectURL(file);preview.src=preview.dataset.objectUrl;preview.hidden=false;
};
$('#addStudent').onclick=()=>openStudent();$('#closeModal').onclick=$('#cancelModal').onclick=()=>{$('#modal').hidden=true;$('#studentPhoto').value='';};
function editStudent(id){const s=students.find(x=>x.id===id);if(s)openStudent(s);}
$('#studentForm').onsubmit=async e=>{
  e.preventDefault();
  const photo=$('#studentPhoto').files?.[0]||null;
  const row=Object.fromEntries(new FormData(e.target));
  delete row.studentPhoto;
  row.monthly_fee=Number(row.monthly_fee||0);row.updated_at=new Date().toISOString();
  const isNew=!row.id,oldStudent=students.find(s=>s.id===row.id);
  if(oldStudent?.photo_path)row.photo_path=oldStudent.photo_path;
  if(isNew){delete row.id;row.created_by=profile.id;}
  if(!navigator.onLine){
    if(photo){alert('Connect to the internet before saving a student photo.');return;}
    queue('upsert','students',row);if(isNew)students.unshift({...row,id:'offline-'+Date.now()});
    renderStudents();$('#modal').hidden=true;return;
  }
  const saveButton=e.currentTarget.querySelector('button[type=submit],button:not([type])');
  if(saveButton){saveButton.disabled=true;saveButton.textContent='Saving…';}
  try{
    const {data,error}=await client.from('students').upsert(row,{onConflict:'admission_no'}).select().single();
    if(error)throw error;
    if(photo){
      const extension=photo.type==='image/jpeg'?'jpg':photo.type.split('/')[1];
      const path=`${data.id}/${Date.now()}.${extension}`;
      const {error:uploadError}=await client.storage.from('student-photos').upload(path,photo,{contentType:photo.type,upsert:false});
      if(uploadError){msg('Student saved, but photo upload failed: '+uploadError.message);}
      else{
        const {error:updateError}=await client.from('students').update({photo_path:path}).eq('id',data.id);
        if(updateError)msg('Photo uploaded, but its student record was not updated: '+updateError.message);
      }
    }
    $('#modal').hidden=true;$('#studentPhoto').value='';await loadStudents();
  }catch(error){msg(error.message||'Could not save student.');}
  finally{if(saveButton){saveButton.disabled=false;saveButton.textContent='Save student';}}
};
function workbook(rows,name){if(!window.XLSX){alert('Excel library is not loaded. Connect to the internet and refresh.');return;}const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Students');XLSX.writeFile(wb,name);}
const templateHeaders=['admission_no','full_name','date_of_birth','class_name','gender','date_of_joining','guardian_name','guardian_phone','alternate_phone','guardian_email','address','care_notes','monthly_fee','status'];
$('#template').onclick=()=>workbook([Object.fromEntries(templateHeaders.map(h=>[h,'']))],'disha-student-import-template.xlsx');
$('#exportStudents').onclick=()=>workbook(students.map(s=>Object.fromEntries(templateHeaders.map(h=>[h,s[h]??'']))),'disha-preschool-all-students.xlsx');
$('#importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows.length)throw Error('The first worksheet is empty.');const valid=rows.filter(r=>r.admission_no&&r.full_name);if(!valid.length)throw Error('Required columns: admission_no and full_name. Download the template for the correct format.');const existing=new Set(students.map(s=>String(s.admission_no).toLowerCase()));let added=0,skipped=0;for(const raw of valid){const row={};for(const h of templateHeaders)row[h]=raw[h]??null;if(existing.has(String(row.admission_no).toLowerCase())){skipped++;continue;}row.monthly_fee=Number(row.monthly_fee||0);row.status=row.status||'Active';row.created_by=profile.id;const {error}=await client.from('students').insert(row);if(error){skipped++;console.error(error);continue;}existing.add(String(row.admission_no).toLowerCase());added++;}await loadStudents();alert(`Import complete. Added: ${added}. Skipped (duplicates/errors): ${skipped}.`);}catch(err){alert('Import failed: '+err.message);}finally{e.target.value='';}};
async function renderAttendance(){if(!client)return;$('#attDate').value ||= new Date().toISOString().slice(0,10);const {data,error}=await client.from('attendance').select('student_id,status').eq('attendance_date',$('#attDate').value);if(error){msg(error.message);return;}const map=new Map((data||[]).map(x=>[x.student_id,x.status]));$('#attendanceTable').innerHTML=`<table><thead><tr><th>Admission no.</th><th>Student</th><th>Class</th><th>Status</th></tr></thead><tbody>${students.filter(s=>s.status==='Active').map(s=>`<tr><td>${esc(s.admission_no)}</td><td>${esc(s.full_name)}</td><td>${esc(s.class_name)}</td><td><select data-att="${s.id}"><option ${map.get(s.id)==='Present'?'selected':''}>Present</option><option ${map.get(s.id)==='Absent'?'selected':''}>Absent</option><option ${map.get(s.id)==='Late'?'selected':''}>Late</option><option ${map.get(s.id)==='Leave'?'selected':''}>Leave</option></select></td></tr>`).join('')}</tbody></table>`;}
$('#attDate').onchange=renderAttendance;$('#saveAttendance').onclick=async()=>{const date=$('#attDate').value;const rows=[...document.querySelectorAll('[data-att]')].map(x=>({student_id:x.dataset.att,attendance_date:date,status:x.value,marked_by:profile.id}));if(!navigator.onLine){rows.forEach(r=>queue('upsert','attendance',r));return;}for(const r of rows){const {error}=await client.from('attendance').upsert(r,{onConflict:'student_id,attendance_date'});if(error){msg(error.message);return;}}msg('Attendance saved.');};
async function loadFees(){const {data,error}=await client.from('fee_payments').select('*,students(full_name,admission_no)').order('payment_date',{ascending:false});if(error){msg(error.message);return;}$('#feeTable').innerHTML=table((data||[]).map(x=>({student:x.students?.full_name||'',admission_no:x.students?.admission_no||'',amount:'₹'+x.amount,month:x.fee_month,payment_date:x.payment_date,mode:x.payment_mode})),['student','admission_no','amount','month','payment_date','mode']);}
$('#addPayment').onclick=async()=>{if(!students.length){alert('Add students first.');return;}const id=prompt('Enter the student admission number:');const s=students.find(x=>x.admission_no===id);if(!s){alert('Student not found.');return;}const amount=Number(prompt('Payment amount (₹):'));if(!amount||amount<0)return;const month=prompt('Fee month (e.g. November 2026):','November 2026');const row={student_id:s.id,amount,fee_month:month||'',payment_date:new Date().toISOString().slice(0,10),payment_mode:'Cash',recorded_by:profile.id};const {error}=await client.from('fee_payments').insert(row);if(error){msg(error.message);return;}loadFees();};

// Staff directory and private staff photo uploads (Admin-managed).
async function staffPhotoUrl(path){
  if(!path||!client||!navigator.onLine)return '';
  const {data,error}=await client.storage.from('staff-photos').createSignedUrl(path,3600);
  if(error){console.warn('Could not create staff photo URL:',error.message);return '';}
  return data?.signedUrl||'';
}
async function loadStaffDirectory(){
  const host=$('#staffTable');if(!host||!client)return;
  host.innerHTML='<p class="muted">Loading staff profiles…</p>';
  const {data,error}=await client.from('staff_directory').select('*').order('full_name');
  if(error){host.innerHTML='<p class="message">Could not load staff directory: '+esc(error.message)+'</p>';return;}
  staffMembers=data||[];await renderStaffDirectory();
}
async function renderStaffDirectory(){
  const host=$('#staffTable');if(!host)return;
  if(!staffMembers.length){host.innerHTML='<p class="muted">No staff profiles yet. Select “Add staff profile” to create the first directory entry.</p>';return;}
  const urls=await Promise.all(staffMembers.map(x=>staffPhotoUrl(x.photo_path)));
  host.innerHTML=`<table><thead><tr><th>Photo</th><th>Name</th><th>Designation</th><th>Email</th><th>Phone</th><th>Status</th><th>Action</th></tr></thead><tbody>${staffMembers.map((x,i)=>`<tr><td>${urls[i]?`<img class="staff-thumb" src="${esc(urls[i])}" alt="${esc(x.full_name)}">`:'<span class="photo-placeholder">👩‍🏫</span>'}</td><td><b>${esc(x.full_name)}</b><br><small>${esc(x.bio||'')}</small></td><td>${esc(x.designation)}</td><td>${esc(x.email||'')}</td><td>${esc(x.phone||'')}</td><td>${x.active?'<span class="tag">Active</span>':'Inactive'}</td><td><button class="soft" data-staff-edit="${esc(x.id)}">Edit</button></td></tr>`).join('')}</tbody></table>`;
  host.querySelectorAll('[data-staff-edit]').forEach(b=>b.onclick=()=>openStaff(staffMembers.find(x=>x.id===b.dataset.staffEdit)));
}
async function openStaff(item={}){
  const form=$('#staffForm');form.reset();
  for(const [k,v] of Object.entries(item||{}))if(form.elements[k]&&form.elements[k].type!=='file')form.elements[k].value=v??'';
  const preview=$('#staffPhotoPreview');preview.hidden=true;preview.removeAttribute('src');
  if(item?.photo_path){const url=await staffPhotoUrl(item.photo_path);if(url){preview.src=url;preview.hidden=false;}}
  $('#staffModalTitle').textContent=item?.id?'Edit staff profile':'Add staff profile';$('#staffModal').hidden=false;
}
$('#addStaff').onclick=()=>openStaff();
$('#closeStaffModal').onclick=$('#cancelStaffModal').onclick=()=>{$('#staffModal').hidden=true;$('#staffPhoto').value='';};
$('#staffPhoto').onchange=e=>{
  const file=e.target.files?.[0],preview=$('#staffPhotoPreview');
  if(!file){preview.hidden=true;return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){alert('Choose a JPG, PNG or WEBP image.');e.target.value='';preview.hidden=true;return;}
  if(file.size>2*1024*1024){alert('Staff photo must be 2 MB or smaller.');e.target.value='';preview.hidden=true;return;}
  if(preview.dataset.objectUrl)URL.revokeObjectURL(preview.dataset.objectUrl);
  preview.dataset.objectUrl=URL.createObjectURL(file);preview.src=preview.dataset.objectUrl;preview.hidden=false;
};
$('#staffForm').onsubmit=async e=>{
  e.preventDefault();if(profile?.role!=='admin'){alert('Only Admin can manage staff profiles.');return;}
  const photo=$('#staffPhoto').files?.[0]||null;
  const row=Object.fromEntries(new FormData(e.currentTarget));delete row.id;
  const id=e.currentTarget.elements.id.value;const old=staffMembers.find(x=>x.id===id);
  if(old?.photo_path)row.photo_path=old.photo_path;
  if(!navigator.onLine){alert('Connect to the internet to save staff profiles and photos.');return;}
  const submit=e.currentTarget.querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Saving…';
  try{
    let result;
    if(id)result=await client.from('staff_directory').update({...row,updated_at:new Date().toISOString()}).eq('id',id).select().single();
    else result=await client.from('staff_directory').insert(row).select().single();
    if(result.error)throw result.error;
    const saved=result.data;
    if(photo){const ext=photo.type==='image/jpeg'?'jpg':photo.type.split('/')[1];const path=`${saved.id}/${Date.now()}.${ext}`;
      const up=await client.storage.from('staff-photos').upload(path,photo,{contentType:photo.type,upsert:false});if(up.error)throw up.error;
      const upd=await client.from('staff_directory').update({photo_path:path,updated_at:new Date().toISOString()}).eq('id',saved.id);if(upd.error)throw upd.error;
    }
    $('#staffModal').hidden=true;$('#staffPhoto').value='';$('#staffMessage').textContent='Staff profile saved.';await loadStaffDirectory();
  }catch(err){$('#staffMessage').textContent='Could not save staff profile: '+(err.message||err);}
  finally{submit.disabled=false;submit.textContent='Save staff profile';}
};


// Daily child records: one editable record per child and date.
function selectedDailyStudent(){return $('#dailyStudent')?.value||'';}
async function loadDailyRecords(){
  if(!client||!students.length)return;
  $('#dailyDate').value ||= localDateString();
  const className=$('#dailyClass').value;
  const filtered=students.filter(s=>s.status==='Active'&&(!className||s.class_name===className));
  $('#dailyStudent').innerHTML=filtered.map(s=>`<option value="${esc(s.id)}">${esc(s.full_name)} · ${esc(s.class_name)}</option>`).join('');
  await loadDailyRecordForSelection();
  await renderDailyTable();
}
async function loadDailyRecordForSelection(){
  const sid=selectedDailyStudent(),date=$('#dailyDate').value;
  $('#dailyRecordForm').reset();$('#dailyDemo').checked=false;
  if(!sid||!date)return;
  const {data,error}=await client.from('daily_child_records').select('*').eq('student_id',sid).eq('record_date',date).maybeSingle();
  if(error){$('#dailyMessage').textContent=error.message;return;}
  if(data){for(const k of ['learning_topics','activities','participation','behaviour','food_snacks','teacher_notes'])$('#dailyRecordForm').elements[k].value=data[k]||'';$('#dailyDemo').checked=!!data.is_demo;}
  $('#dailyMessage').textContent=data?'Existing record loaded. You can edit and save it.':'No record for this child and date yet.';
}
async function renderDailyTable(){
  const {data,error}=await client.from('daily_child_records').select('id,student_id,record_date,learning_topics,activities,is_demo,students(full_name,class_name)').order('record_date',{ascending:false}).limit(100);
  if(error){$('#dailyTable').innerHTML=`<p class="message">${esc(error.message)}</p>`;return;}
  $('#dailyTable').innerHTML=(data||[]).length?`<table><thead><tr><th>Date</th><th>Child</th><th>Class</th><th>Learning</th><th>Activities</th><th>Type</th><th>Action</th></tr></thead><tbody>${data.map(r=>`<tr><td>${esc(r.record_date)}</td><td>${esc(r.students?.full_name||'')}</td><td>${esc(r.students?.class_name||'')}</td><td>${esc(r.learning_topics||'')}</td><td>${esc(r.activities||'')}</td><td>${r.is_demo?'<span class="demo-tag">DEMO</span>':'Actual'}</td><td><button class="soft" data-daily-edit="${esc(r.student_id)}" data-date="${esc(r.record_date)}">Edit</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">No daily records saved yet.</p>';
  $('#dailyTable').querySelectorAll('[data-daily-edit]').forEach(b=>b.onclick=async()=>{$('#dailyStudent').value=b.dataset.dailyEdit;$('#dailyDate').value=b.dataset.date;await loadDailyRecordForSelection();});
}
$('#dailyDate').onchange=loadDailyRecordForSelection;
$('#dailyStudent').onchange=loadDailyRecordForSelection;
$('#dailyClass').onchange=loadDailyRecords;
$('#refreshDaily').onclick=renderDailyTable;
$('#dailyRecordForm').onsubmit=async e=>{
  e.preventDefault();const sid=selectedDailyStudent(),date=$('#dailyDate').value;
  if(!sid||!date){$('#dailyMessage').textContent='Choose a child and date first.';return;}
  const f=new FormData(e.currentTarget),row={student_id:sid,record_date:date,recorded_by:profile.id,updated_at:new Date().toISOString(),is_demo:$('#dailyDemo').checked};
  for(const k of ['learning_topics','activities','participation','behaviour','food_snacks','teacher_notes'])row[k]=String(f.get(k)||'').trim();
  const {error}=await client.from('daily_child_records').upsert(row,{onConflict:'student_id,record_date'});
  if(error){$('#dailyMessage').textContent='Could not save: '+error.message;return;}
  $('#dailyMessage').textContent='Daily child record saved successfully.';await renderDailyTable();
};

// Timetable CRUD. Breaks, assembly, lunch and dispersal are normal editable activities.
async function loadTimetable(){
  if(!client)return;
  const [{data,error},{data:staffRows}]=await Promise.all([
    client.from('timetable').select('*').order('class_name').order('weekday').order('start_time'),
    client.from('profiles').select('id,display_name,role').in('role',['admin','teacher']).order('display_name')
  ]);
  if(error){$('#timetableTable').innerHTML=`<p class="message">${esc(error.message)}</p>`;return;}
  const staffSelect=$('#timetableStaff'),previous=staffSelect.value;
  staffSelect.innerHTML='<option value="">Not assigned</option>'+(staffRows||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.display_name)} (${esc(p.role)})</option>`).join('');
  staffSelect.value=previous;
  window.dishaStaffProfiles=staffRows||[];
  window.dishaTimetableRows=data||[];renderTimetable();
}
function renderTimetable(){
  const c=$('#timetableFilter').value,d=$('#timetableDayFilter').value;
  const rows=(window.dishaTimetableRows||[]).filter(r=>(!c||r.class_name===c)&&(!d||r.weekday===d));
  $('#timetableTable').innerHTML=rows.length?`<table><thead><tr><th>Class</th><th>Day</th><th>Time</th><th>Activity</th><th>Teacher ID</th><th>Actions</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.class_name)}</td><td>${esc(r.weekday)}</td><td>${esc((r.start_time||'').slice(0,5))}–${esc((r.end_time||'').slice(0,5))}</td><td>${esc(r.activity)}</td><td>${esc(window.dishaStaffProfiles?.find(p=>p.id===r.assigned_staff)?.display_name||'—')}</td><td><button class="soft" data-timetable-edit="${esc(r.id)}">Edit</button> <button class="danger" data-timetable-delete="${esc(r.id)}">Delete</button></td></tr>`).join('')}</tbody></table>`:'<p class="muted">No timetable periods found. Use the form or create the suggested timetable for all classes.</p>';
  $('#timetableTable').querySelectorAll('[data-timetable-edit]').forEach(b=>b.onclick=()=>{const r=window.dishaTimetableRows.find(x=>x.id===b.dataset.timetableEdit),f=$('#timetableForm');for(const [k,v] of Object.entries(r))if(f.elements[k])f.elements[k].value=v??'';});
  $('#timetableTable').querySelectorAll('[data-timetable-delete]').forEach(b=>b.onclick=async()=>{if(!confirm('Delete this timetable period?'))return;const {error}=await client.from('timetable').delete().eq('id',b.dataset.timetableDelete);if(error){$('#timetableMessage').textContent=error.message;return;}await loadTimetable();});
}
$('#timetableFilter').onchange=renderTimetable;$('#timetableDayFilter').onchange=renderTimetable;
$('#clearTimetable').onclick=()=>$('#timetableForm').reset();
$('#createDefaultTimetables').onclick=async()=>{if(!confirm('Create the suggested 9 AM–4 PM schedule for each class that does not already have a timetable? Existing class timetables will be left unchanged.'))return;await createDefaultTimetables();};
$('#timetableForm').onsubmit=async e=>{
  e.preventDefault();const f=new FormData(e.currentTarget),id=String(f.get('id')||'');
  const row={class_name:f.get('class_name'),weekday:f.get('weekday'),start_time:f.get('start_time'),end_time:f.get('end_time'),activity:String(f.get('activity')||'').trim(),assigned_staff:f.get('assigned_staff')||null};
  if(row.end_time<=row.start_time){$('#timetableMessage').textContent='End time must be after start time.';return;}
  const result=id?await client.from('timetable').update(row).eq('id',id):await client.from('timetable').insert(row);
  if(result.error){$('#timetableMessage').textContent='Could not save: '+result.error.message;return;}
  $('#timetableMessage').textContent='Timetable period saved.';e.currentTarget.reset();await loadTimetable();
};
async function createDefaultTimetables(){
  const existing=window.dishaTimetableRows||[];
  const classes=['Playgroup','Nursery','Junior KG','Senior KG'];
  const slots=[
    ['09:00','09:20','Assembly & welcome'],['09:20','10:00','Period 1 – Montessori work cycle'],['10:00','10:10','Break'],['10:10','10:50','Period 2 – Language'],['10:50','11:00','Break'],['11:00','11:40','Period 3 – Numeracy'],['11:40','11:50','Break'],['11:50','12:30','Period 4 – Sensorial / practical life'],['12:30','13:30','Lunch'],['13:30','14:10','Period 5 – Art / music'],['14:10','14:20','Break'],['14:20','15:00','Period 6 – Outdoor play'],['15:00','15:10','Break'],['15:10','15:50','Period 7 – Story / group activity'],['15:50','16:00','Dispersal']
  ];
  const days=['Monday','Tuesday','Wednesday','Thursday','Friday'];let inserted=0,skipped=0;
  for(const cl of classes){
    if(existing.some(r=>r.class_name===cl)){skipped++;continue;}
    const rows=days.flatMap(day=>slots.map(s=>({class_name:cl,weekday:day,start_time:s[0],end_time:s[1],activity:s[2]})));
    const {error}=await client.from('timetable').insert(rows);
    if(error){$('#timetableMessage').textContent='Could not create '+cl+': '+error.message;return;}
    inserted++;
  }
  $('#timetableMessage').textContent=`Default timetable created for ${inserted} class(es). Existing timetable classes skipped: ${skipped}. Edit any period above.`;
  await loadTimetable();
}


// Clearly labelled test data: five weekdays for every currently active enrolled child.
// Run only when the school wants sample data; it never overwrites existing records.
$('#generateDemoRecords').onclick=async()=>{
  const active=students.filter(s=>s.status==='Active');
  if(!active.length){alert('There are no active enrolled students to generate demo records for.');return;}
  if(!confirm(`Create clearly labelled DEMO records for ${active.length} active student(s), Monday to Friday of the current week? Existing child/date records will be kept unchanged.`))return;
  const today=new Date(),monday=new Date(today);monday.setDate(today.getDate()-((today.getDay()+6)%7));
  const dates=Array.from({length:5},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);return localDateString(d);});
  const samples=[
    ['Practical life – spooning and pouring','Montessori shelf work, circle time','Joined the activity with interest','Practised taking turns','Snack taken','Growing confidence with independent work'],
    ['Language – picture cards and sounds','Story time, sandpaper letters','Participated with teacher support','Played cooperatively with peers','Lunch completed','Keep practising new vocabulary'],
    ['Numeracy – counting objects 1–10','Number rods, outdoor movement','Completed the activity independently','Calm and engaged','Snack taken','Shows interest in counting activities'],
    ['Sensorial – colour matching','Colour tablets, music and movement','Enjoyed group participation','Shared materials with reminders','Lunch and water taken','Continue matching and sorting activities'],
    ['Creative expression – drawing and craft','Art, story recap, free play','Expressed ideas confidently','Friendly interaction with classmates','Snack taken','A happy and active week']
  ];
  let inserted=0,kept=0;
  for(const s of active){
    for(let i=0;i<5;i++){
      const [learning_topics,activities,participation,behaviour,food_snacks,teacher_notes]=samples[i];
      const {data,error}=await client.from('daily_child_records').upsert({student_id:s.id,record_date:dates[i],learning_topics,activities,participation,behaviour,food_snacks,teacher_notes,is_demo:true,recorded_by:profile.id},{onConflict:'student_id,record_date',ignoreDuplicates:true}).select('id');
      if(error){$('#dailyMessage').textContent='Demo generation stopped: '+error.message;return;}
      if(data?.length)inserted++;else kept++;
    }
  }
  // Save the current week's parent report snapshot now so Friday's parent popup
  // is ready immediately for this test run.
  const start=dates[0],end=dates[4];
  for(const s of active){
    const [daily,att,progress,observations]=await Promise.all([
      client.from('daily_child_records').select('record_date,learning_topics,activities,participation,behaviour,food_snacks,teacher_notes,is_demo').eq('student_id',s.id).gte('record_date',start).lte('record_date',end).order('record_date'),
      client.from('attendance').select('attendance_date,status').eq('student_id',s.id).gte('attendance_date',start).lte('attendance_date',end).order('attendance_date'),
      client.from('child_progress').select('recorded_on,domain,note').eq('student_id',s.id).gte('recorded_on',start).lte('recorded_on',end),
      client.from('montessori_observations').select('observed_on,learning_area,activity,observation,progress_level').eq('student_id',s.id).gte('observed_on',start).lte('observed_on',end)
    ]);
    const report_data={
      attendance:(att.data||[]).map(x=>({date:x.attendance_date,status:x.status})),
      daily_records:(daily.data||[]).map(x=>({date:x.record_date,learning_topics:x.learning_topics,activities:x.activities,participation:x.participation,behaviour:x.behaviour,food_snacks:x.food_snacks,teacher_notes:x.teacher_notes,is_demo:true})),
      progress:(progress.data||[]).map(x=>({date:x.recorded_on,domain:x.domain,note:x.note})),
      observations:(observations.data||[]).map(x=>({date:x.observed_on,area:x.learning_area,activity:x.activity,observation:x.observation,level:x.progress_level}))
    };
    const {error}=await client.from('weekly_reports').upsert({student_id:s.id,week_start:start,week_end:end,report_data,generated_by:profile.id,is_demo:true},{onConflict:'student_id,week_start,week_end'});
    if(error){$('#dailyMessage').textContent='Daily demo records saved, but report creation failed: '+error.message;return;}
  }
  $('#dailyMessage').textContent=`Created ${inserted} demo daily records. ${kept} existing records were kept. Friday report snapshots saved for ${active.length} active student(s). All are marked DEMO / TEST DATA.`;
  await renderDailyTable();
};

$('#exportBackup').onclick=()=>{const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),students},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='disha-preschool-backup.json';a.click();URL.revokeObjectURL(a.href);};$('#syncNow').onclick=syncQueue;window.addEventListener('online',syncQueue);window.addEventListener('online',()=>$('#connection').textContent='Connected');window.addEventListener('offline',()=>$('#connection').textContent='Offline');
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).then(reg=>reg.update()).catch(console.error));init();
