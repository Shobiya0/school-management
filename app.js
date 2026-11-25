const SUPABASE_URL = window.DISHA_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.DISHA_SUPABASE_ANON_KEY || '';
const $ = (s)=>document.querySelector(s);
let client=null, profile=null, students=[], attendance=[];
const labels={dashboard:['Dashboard','Your school at a glance'],students:['Students','Student records and Excel tools'],attendance:['Attendance','Daily class attendance'],fees:['Fees & payments','Track student payments'],operations:['School records','Additional school operations'],users:['Staff access','Manage authorized school accounts'],settings:['Settings & backup','Connection and data safety']};
const onlineReady=()=>!!client;
function msg(t){$('#syncStatus').textContent=t;}
function esc(v=''){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function show(view){if(profile?.role!=='admin'&&['users'].includes(view))view='dashboard';document.querySelectorAll('.view').forEach(x=>x.hidden=x.id!==view);document.querySelectorAll('.nav').forEach(x=>x.classList.toggle('active',x.dataset.view===view));$('#heading').textContent=labels[view][0];$('#subheading').textContent=labels[view][1];if(view==='students')renderStudents();if(view==='attendance')renderAttendance();if(view==='fees')loadFees();if(view==='dashboard')renderDashboard();}
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
async function enterApp(){const {data:{session}}=await client.auth.getSession();const user=session?.user;if(!user)return;let data=null,error=null;if(navigator.onLine){({data,error}=await client.from('profiles').select('display_name,role').eq('id',user.id).single());if(!error)localStorage.setItem('dishaProfileCache',JSON.stringify({...data,email:user.email,id:user.id}));}else{data=JSON.parse(localStorage.getItem('dishaProfileCache')||'null');if(!data)error={message:'First sign-in and profile sync require internet.'};}if(error){$('#authMsg').textContent='Your account profile is unavailable. Connect to the internet or ask the school Admin to complete staff setup.';return;}profile={...data,email:user.email,id:user.id};$('#login').hidden=true;$('#app').hidden=false;$('#role').textContent=profile.role.toUpperCase();document.querySelectorAll('.admin-only').forEach(x=>x.hidden=profile.role!=='admin');await syncQueue();await loadStudents();show('dashboard');}
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
function renderStudents(){const q=($('#search')?.value||'').toLowerCase(),cl=$('#classFilter')?.value||'';const rows=students.filter(s=>(!cl||s.class_name===cl)&&[s.full_name,s.admission_no,s.guardian_name,s.guardian_phone].some(v=>String(v||'').toLowerCase().includes(q)));$('#studentTable').innerHTML=table(rows,['admission_no','full_name','class_name','guardian_name','guardian_phone','status']);document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>editStudent(b.dataset.edit));}
$('#search').oninput=renderStudents;$('#classFilter').onchange=renderStudents;
function openStudent(s={}){const f=$('#studentForm');f.reset();for(const [k,v] of Object.entries(s))if(f.elements[k])f.elements[k].value=v??'';$('#modalTitle').textContent=s.id?'Edit student':'Add student';$('#modal').hidden=false;}
$('#addStudent').onclick=()=>openStudent();$('#closeModal').onclick=$('#cancelModal').onclick=()=>$('#modal').hidden=true;
function editStudent(id){const s=students.find(x=>x.id===id);if(s)openStudent(s);}
$('#studentForm').onsubmit=async e=>{e.preventDefault();const row=Object.fromEntries(new FormData(e.target));row.monthly_fee=Number(row.monthly_fee||0);row.updated_at=new Date().toISOString();const isNew=!row.id;if(isNew){delete row.id;row.created_by=profile.id;}if(!navigator.onLine){queue('upsert','students',row);if(isNew)students.unshift({...row,id:'offline-'+Date.now()});renderStudents();$('#modal').hidden=true;return;}const {data,error}=await client.from('students').upsert(row,{onConflict:'admission_no'}).select().single();if(error){msg(error.message);return;}$('#modal').hidden=true;await loadStudents();};
function workbook(rows,name){if(!window.XLSX){alert('Excel library is not loaded. Connect to the internet and refresh.');return;}const ws=XLSX.utils.json_to_sheet(rows);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Students');XLSX.writeFile(wb,name);}
const templateHeaders=['admission_no','full_name','date_of_birth','class_name','gender','date_of_joining','guardian_name','guardian_phone','alternate_phone','guardian_email','address','care_notes','monthly_fee','status'];
$('#template').onclick=()=>workbook([Object.fromEntries(templateHeaders.map(h=>[h,'']))],'disha-student-import-template.xlsx');
$('#exportStudents').onclick=()=>workbook(students.map(s=>Object.fromEntries(templateHeaders.map(h=>[h,s[h]??'']))),'disha-preschool-all-students.xlsx');
$('#importFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array'});const rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:''});if(!rows.length)throw Error('The first worksheet is empty.');const valid=rows.filter(r=>r.admission_no&&r.full_name);if(!valid.length)throw Error('Required columns: admission_no and full_name. Download the template for the correct format.');const existing=new Set(students.map(s=>String(s.admission_no).toLowerCase()));let added=0,skipped=0;for(const raw of valid){const row={};for(const h of templateHeaders)row[h]=raw[h]??null;if(existing.has(String(row.admission_no).toLowerCase())){skipped++;continue;}row.monthly_fee=Number(row.monthly_fee||0);row.status=row.status||'Active';row.created_by=profile.id;const {error}=await client.from('students').insert(row);if(error){skipped++;console.error(error);continue;}existing.add(String(row.admission_no).toLowerCase());added++;}await loadStudents();alert(`Import complete. Added: ${added}. Skipped (duplicates/errors): ${skipped}.`);}catch(err){alert('Import failed: '+err.message);}finally{e.target.value='';}};
async function renderAttendance(){if(!client)return;$('#attDate').value ||= new Date().toISOString().slice(0,10);const {data,error}=await client.from('attendance').select('student_id,status').eq('attendance_date',$('#attDate').value);if(error){msg(error.message);return;}const map=new Map((data||[]).map(x=>[x.student_id,x.status]));$('#attendanceTable').innerHTML=`<table><thead><tr><th>Admission no.</th><th>Student</th><th>Class</th><th>Status</th></tr></thead><tbody>${students.filter(s=>s.status==='Active').map(s=>`<tr><td>${esc(s.admission_no)}</td><td>${esc(s.full_name)}</td><td>${esc(s.class_name)}</td><td><select data-att="${s.id}"><option ${map.get(s.id)==='Present'?'selected':''}>Present</option><option ${map.get(s.id)==='Absent'?'selected':''}>Absent</option><option ${map.get(s.id)==='Late'?'selected':''}>Late</option><option ${map.get(s.id)==='Leave'?'selected':''}>Leave</option></select></td></tr>`).join('')}</tbody></table>`;}
$('#attDate').onchange=renderAttendance;$('#saveAttendance').onclick=async()=>{const date=$('#attDate').value;const rows=[...document.querySelectorAll('[data-att]')].map(x=>({student_id:x.dataset.att,attendance_date:date,status:x.value,marked_by:profile.id}));if(!navigator.onLine){rows.forEach(r=>queue('upsert','attendance',r));return;}for(const r of rows){const {error}=await client.from('attendance').upsert(r,{onConflict:'student_id,attendance_date'});if(error){msg(error.message);return;}}msg('Attendance saved.');};
async function loadFees(){const {data,error}=await client.from('fee_payments').select('*,students(full_name,admission_no)').order('payment_date',{ascending:false});if(error){msg(error.message);return;}$('#feeTable').innerHTML=table((data||[]).map(x=>({student:x.students?.full_name||'',admission_no:x.students?.admission_no||'',amount:'₹'+x.amount,month:x.fee_month,payment_date:x.payment_date,mode:x.payment_mode})),['student','admission_no','amount','month','payment_date','mode']);}
$('#addPayment').onclick=async()=>{if(!students.length){alert('Add students first.');return;}const id=prompt('Enter the student admission number:');const s=students.find(x=>x.admission_no===id);if(!s){alert('Student not found.');return;}const amount=Number(prompt('Payment amount (₹):'));if(!amount||amount<0)return;const month=prompt('Fee month (e.g. November 2026):','November 2026');const row={student_id:s.id,amount,fee_month:month||'',payment_date:new Date().toISOString().slice(0,10),payment_mode:'Cash',recorded_by:profile.id};const {error}=await client.from('fee_payments').insert(row);if(error){msg(error.message);return;}loadFees();};
$('#exportBackup').onclick=()=>{const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),students},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='disha-preschool-backup.json';a.click();URL.revokeObjectURL(a.href);};$('#syncNow').onclick=syncQueue;window.addEventListener('online',syncQueue);window.addEventListener('online',()=>$('#connection').textContent='Connected');window.addEventListener('offline',()=>$('#connection').textContent='Offline');
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(console.error));init();
