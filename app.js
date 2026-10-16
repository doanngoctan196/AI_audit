/* ===== CẤU HÌNH AI REVIEW ===== */
const AI_CONFIG={
  provider:'anthropic',   // mô hình chọn sẵn trong hộp thoại: 'anthropic' | 'openai' | 'gemini' | 'sample'
  workerUrl:'https://holy-sun-e5fd.doanngoctan196.workers.dev/',  // Cloudflare Worker giữ khóa API (khóa không nằm trong trình duyệt)
  maxTokens:16000,   // Gemini 2.5 tính cả token "suy nghĩ" vào mức này; tăng nếu CSV bị cắt (worker chặn ở 16000)
  timeoutMs:120000,       // thời gian chờ tối đa cho một lần review
  skipEmpty:true,         // AI review: bỏ ô trống không bắt buộc khỏi yêu cầu để AI xử lý nhanh hơn (false = gửi tất cả)
  providers:{
    anthropic:{label:'Claude (Anthropic)',model:'claude-sonnet-5-5'},  // kiểm tra mã model còn hiệu lực với tài khoản của bạn
    openai:{label:'GPT (OpenAI)',model:'gpt-4o'},
    gemini:{label:'Gemini (Google)',model:'gemini-3.8-flash'},
    sample:{label:'Claude qua claude.ai (thử, không cần worker)'}      // chỉ chạy khi trang mở trong claude.ai
  },
  promptFiles:{review:'prompts/review.md',import:'prompts/import.md'}  // nội dung prompt nằm trong các file này, sửa trực tiếp, không cần sửa app.js
};

/* ---------- tiện ích ---------- */
const $=(s,r=document)=>r.querySelector(s);
function h(tag,attrs,...kids){
  const e=document.createElement(tag);
  for(const [k,v] of Object.entries(attrs||{})){
    if(v==null||v===false)continue;
    if(k==='class')e.className=v;
    else if(k.startsWith('on'))e.addEventListener(k.slice(2),v);
    else e.setAttribute(k,v===true?'':v);
  }
  for(const c of kids.flat()){ if(c==null||c===false)continue; e.append(c.nodeType?c:document.createTextNode(String(c))); }
  return e;
}
const num=v=>{const n=parseFloat(v);return isNaN(n)?0:n};
const fmtN=(n,d=0)=>Number(n).toLocaleString('vi-VN',{maximumFractionDigits:d,minimumFractionDigits:d});
const noDiacritics=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toUpperCase();
const hasDia=s=>/[^\u0000-\u007f]/.test(s);
const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function toast(t,ms){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>e.classList.remove('show'),ms||2200)}

/* ---------- bảng mã tham chiếu (đối chiếu với bảng mã trong ứng dụng khai báo) ---------- */
const L={
 ihinh:[['A11','Nhập kinh doanh tiêu dùng'],['A12','Nhập kinh doanh sản xuất'],['A21','Chuyển tiêu thụ nội địa từ nguồn tạm nhập'],['A31','Nhập hàng xuất khẩu bị trả lại'],['A41','Nhập kinh doanh của doanh nghiệp đầu tư'],['A42','Chuyển tiêu thụ nội địa khác'],['E11','Nhập nguyên liệu của DNCX'],['E21','Nhập nguyên liệu để gia công cho thương nhân nước ngoài'],['E31','Nhập nguyên liệu để sản xuất xuất khẩu'],['E41','Nhập sản phẩm thuê gia công ở nước ngoài'],['G11','Tạm nhập hàng kinh doanh tạm nhập tái xuất'],['G12','Tạm nhập máy móc, thiết bị phục vụ dự án có thời hạn'],['G13','Tạm nhập miễn thuế'],['G14','Tạm nhập khác'],['C11','Hàng gửi kho ngoại quan'],['H11','Hàng nhập khẩu khác']],
 ehinh:[['B11','Xuất kinh doanh'],['B12','Xuất sau khi tạm xuất'],['B13','Xuất trả hàng nhập khẩu'],['E52','Xuất sản phẩm gia công'],['G21','Tái xuất hàng kinh doanh tạm nhập tái xuất'],['G22','Tái xuất máy móc, thiết bị phục vụ dự án có thời hạn'],['G23','Tái xuất miễn thuế'],['H21','Xuất khẩu khác']],
 pt:[['1','Đường không'],['2','Đường biển (container)'],['3','Đường biển (hàng rời, lỏng)'],['4','Đường bộ (xe tải)'],['5','Đường sắt'],['6','Đường sông'],['9','Khác']],
 hdloai:[['A','A – Hóa đơn thương mại'],['B','B – Hóa đơn khác (không thanh toán)'],['C','C – Không có hóa đơn']],
 ttpt:[['TTR','TTR – Chuyển tiền'],['LC','LC – Thư tín dụng'],['DA','DA – Nhờ thu chấp nhận chứng từ'],['DP','DP – Nhờ thu trả tiền ngay'],['KC','KC – Khác / không thanh toán']],
 dkgia:['CIF','CIP','CFR','CPT','DAP','DDP','DPU','EXW','FCA','FAS','FOB'].map(x=>[x,x]),
 dvtl:[['KGM','KGM – Ki-lô-gam'],['TNE','TNE – Tấn']],
 dvkien:['CT','PK','PX','BG','DR','CS','RO','BX','UN'],
 dvt:['PCE','SET','KGM','MTR','MTK','LTR','PR','BX','CTN','TNE','DZN','ROL'],
 tien:['USD','VND','EUR','CNY','JPY','KRW','THB','SGD','GBP','AUD']
};
const ATT=['Hóa đơn thương mại','Phiếu đóng gói (packing list)','Vận đơn (B/L, AWB)','Hợp đồng thương mại','Chứng nhận xuất xứ (C/O)','Giấy phép / giấy đăng ký kiểm tra chuyên ngành','Chứng từ chứng minh trị giá (báo giá, bảo hiểm, cước…)','Chứng từ khác'];

/* ---------- cấu hình trường & phần ---------- */
const F=(k,l,o={})=>({k,l,...o});
function build(mode){
  const imp=mode==='IDA';
  const S=[];
  S.push({id:'chung',title:'Thông tin chung',desc:imp?'Loại hình, cơ quan hải quan và phương thức vận chuyển của lô hàng nhập khẩu.':'Loại hình, cơ quan hải quan và phương thức vận chuyển của lô hàng xuất khẩu.',fields:[
    F('loai_hinh','Mã loại hình',{req:1,up:1,w:4,list:imp?'ihinh':'ehinh',hint:'Chọn trong gợi ý hoặc nhập mã khác',max:3}),
    F('ma_hq','Mã Chi cục Hải quan đăng ký',{up:1,w:4,fmt:'hq',hint:'4 ký tự. Bỏ trống thì hệ thống tự xác định',max:4}),
    F('pt_vc','Phương thức vận chuyển',{req:1,w:4,type:'select',opts:L.pt}),
    F(imp?'ngay_dk':'ngay_xk',imp?'Ngày đăng ký dự kiến':'Ngày dự kiến xuất khẩu',{w:4,type:'date'}),
    F('so_tk_dau','Số tờ khai đầu tiên',{w:4,up:1,fmt:'tk',hint:'Chỉ khai khi lô hàng chia thành nhiều tờ khai: nhập F cho tờ đầu tiên, từ tờ thứ 2 nhập số tờ khai đầu tiên',max:12})
  ]});
  if(imp){
    S.push({id:'nk',title:'Người nhập khẩu',fields:[
      F('nk_ma','Mã số thuế người nhập khẩu',{req:1,w:4,fmt:'mst',hint:'10 hoặc 13 số',max:14}),
      F('nk_ten','Tên người nhập khẩu',{req:1,w:8,nd:1,max:300}),
      F('nk_bc','Mã bưu chính',{w:3,max:9}),
      F('nk_dc','Địa chỉ',{req:1,w:9,nd:1,max:300}),
      F('nk_sdt','Số điện thoại',{w:4,max:20}),
      F('ut_ma','Mã người ủy thác nhập khẩu',{w:4,fmt:'mst',hint:'Chỉ khai khi nhập khẩu ủy thác',max:14}),
      F('ut_ten','Tên người ủy thác',{w:4,nd:1,max:300})
    ]});
    S.push({id:'xk',title:'Người xuất khẩu (nước ngoài)',fields:[
      F('xk_ten','Tên người xuất khẩu',{req:1,w:6,nd:1,max:300}),
      F('xk_ma','Mã người xuất khẩu',{w:3,max:13}),
      F('xk_nuoc','Mã nước',{req:1,w:3,up:1,fmt:'iso2',hint:'2 chữ cái, ví dụ CN, US, KR',max:2}),
      F('xk_dc','Địa chỉ',{req:1,w:12,nd:1,max:300})
    ]});
  }else{
    S.push({id:'xk',title:'Người xuất khẩu',fields:[
      F('xk_ma','Mã số thuế người xuất khẩu',{req:1,w:4,fmt:'mst',hint:'10 hoặc 13 số',max:14}),
      F('xk_ten','Tên người xuất khẩu',{req:1,w:8,nd:1,max:300}),
      F('xk_bc','Mã bưu chính',{w:3,max:9}),
      F('xk_dc','Địa chỉ',{req:1,w:9,nd:1,max:300}),
      F('xk_sdt','Số điện thoại',{w:4,max:20}),
      F('ut_ma','Mã người ủy thác xuất khẩu',{w:4,fmt:'mst',hint:'Chỉ khai khi xuất khẩu ủy thác',max:14}),
      F('ut_ten','Tên người ủy thác',{w:4,nd:1,max:300})
    ]});
    S.push({id:'nk',title:'Người nhập khẩu (nước ngoài)',fields:[
      F('nk_ten','Tên người nhập khẩu',{req:1,w:6,nd:1,max:300}),
      F('nk_nuoc','Mã nước',{req:1,w:3,up:1,fmt:'iso2',hint:'2 chữ cái, ví dụ US, JP, DE',max:2}),
      F('nk_ma','Mã người nhập khẩu',{w:3,max:13}),
      F('nk_dc','Địa chỉ',{req:1,w:12,nd:1,max:300})
    ]});
  }
  S.push({id:'dl',title:'Đại lý hải quan',desc:'Bỏ trống nếu doanh nghiệp tự khai.',fields:[
    F('dl_ma','Mã số thuế đại lý',{w:4,fmt:'mst',max:14}),
    F('dl_ten','Tên đại lý hải quan',{w:8,nd:1,max:300})
  ]});
  S.push({id:'vc',title:'Vận đơn và vận chuyển',fields:[
    F('vd_so','Số vận đơn',{req:1,w:6,up:1,hint:imp?'Tối đa 5 số vận đơn, cách nhau bằng dấu phẩy':'Số vận đơn nếu đã có',max:120}),
    F('so_kien','Số lượng kiện',{req:1,w:3,type:'number',int:1}),
    F('dv_kien','Đơn vị tính kiện',{w:3,up:1,list:'dvkien',max:3}),
    F('tl_gross','Tổng trọng lượng hàng (Gross)',{req:1,w:3,type:'number'}),
    F('dv_tl','Đơn vị trọng lượng',{w:3,type:'select',opts:L.dvtl}),
    F('so_cont','Số container',{w:6,up:1,hint:'Cách nhau bằng dấu phẩy. Bắt buộc khi đi đường biển container',max:200}),
    F('kho_ma',imp?'Địa điểm lưu giữ hàng chờ thông quan':'Địa điểm tập kết / giám sát hàng',{req:imp?1:0,w:6,up:1,fmt:'kho',hint:'Mã 7 ký tự',max:7}),
    F('xep_ma',imp?'Địa điểm xếp hàng':'Cửa khẩu xuất / nơi xếp hàng',{req:1,w:3,up:1,fmt:'loc',hint:'Mã 5 ký tự, ví dụ '+(imp?'CNSHA':'VNSGN'),max:5}),
    F('do_ma',imp?'Địa điểm dỡ hàng':'Địa điểm đích',{req:1,w:3,up:1,fmt:'loc',hint:'Mã 5 ký tự, ví dụ '+(imp?'VNSGN':'USLAX'),max:5}),
    F('pt_ten','Tên phương tiện / số chuyến',{w:imp?6:9,up:1,nd:1,max:100}),
    imp?F('ngay_den','Ngày hàng đến dự kiến',{w:3,type:'date'}):null
  ].filter(Boolean)});
  S.push({id:'hd',title:'Hóa đơn và thanh toán',fields:[
    F('hd_loai','Phân loại hình thức hóa đơn',{w:4,type:'select',opts:L.hdloai}),
    F('hd_so','Số hóa đơn',{req:1,w:4,up:1,max:35}),
    F('hd_ngay','Ngày phát hành',{req:1,w:4,type:'date'}),
    F('tt_pt','Phương thức thanh toán',{req:1,w:4,type:'select',opts:L.ttpt}),
    F('dk_gia','Điều kiện giá hóa đơn (Incoterms)',{req:1,w:4,type:'select',opts:L.dkgia}),
    F('mt','Mã đồng tiền hóa đơn',{req:1,w:4,up:1,list:'tien',fmt:'iso3',hint:'3 chữ cái, ví dụ USD',max:3}),
    F('hd_tong','Tổng trị giá hóa đơn',{w:4,computed:1,hint:'Tự tính từ các dòng hàng'}),
    F('ty_gia',imp?'Tỷ giá tính thuế (VND / 1 đơn vị ngoại tệ)':'Tỷ giá tính thuế xuất khẩu (VND / 1 đơn vị ngoại tệ)',{req:1,w:8,type:'number',hint:'Lấy theo tỷ giá do cơ quan hải quan công bố tại thời điểm đăng ký tờ khai'})
  ]});
  S.push({id:'hdong',title:'Hợp đồng và giấy phép',fields:[
    F('hdong_so','Số hợp đồng',{w:4,up:1,max:35}),
    F('hdong_ngay','Ngày hợp đồng',{w:4,type:'date'}),
    F('hdong_hh','Ngày hết hạn hợp đồng',{w:4,type:'date'}),
    F('gp_so','Số giấy phép / giấy đăng ký chuyên ngành',{w:12,up:1,max:100,hint:'Nhập từng số, cách nhau bằng dấu phẩy'})
  ]});
  if(imp){
    S.push({id:'tg',title:'Trị giá tính thuế',desc:'Nhập theo đồng tiền của hóa đơn. Hệ thống phân bổ theo tỷ lệ trị giá của từng dòng hàng.',fields:[
      F('vc_phi','Phí vận tải quốc tế',{w:3,type:'number',hint:'Khai khi điều kiện giá chưa gồm cước'}),
      F('bh_phi','Phí bảo hiểm quốc tế',{w:3,type:'number'}),
      F('dc_cong','Khoản điều chỉnh cộng',{w:3,type:'number',hint:'Phí môi giới, bản quyền, hỗ trợ…'}),
      F('dc_tru','Khoản điều chỉnh trừ',{w:3,type:'number',hint:'Giảm giá, chi phí sau nhập khẩu…'}),
      F('dc_ly','Mô tả khoản điều chỉnh',{w:12,nd:1,max:280})
    ]});
  }
  S.push({id:'lines',title:'Danh sách hàng',type:'lines',desc:'Mỗi tờ khai khai tối đa 50 dòng hàng.'});
  S.push({id:'ct',title:'Chứng từ đính kèm và ghi chú',type:'att',fields:[
    F('ghi_chu','Phần ghi chú',{w:12,type:'area',nd:1,max:280,hint:'Tối đa 280 ký tự'})
  ]});
  S.push({id:'review',title:'Soát lỗi và xem lại',type:'review'});
  return S;
}
const LINEF=imp=>[
  {k:'hs',l:'Mã số hàng hóa (HS)',w:3,req:1,fmt:'hs8',hint:'8 chữ số',max:8},
  {k:'mota',l:'Mô tả hàng hóa',w:9,req:1,nd:1,max:280},
  imp?{k:'xx',l:'Xuất xứ (mã nước)',w:2,up:1,fmt:'iso2',max:2}:null,
  {k:'sl',l:'Số lượng',w:2,req:1,type:'number'},
  {k:'dv',l:'Đơn vị tính',w:2,req:1,up:1,list:'dvt',max:3},
  {k:'dg',l:'Đơn giá hóa đơn',w:imp?3:4,req:1,type:'number'},
  {k:'tt',l:'Trị giá hóa đơn',w:imp?3:4,computed:1},
  {k:'ts',l:imp?'Thuế suất nhập khẩu (%)':'Thuế suất xuất khẩu (%)',w:3,type:'number',hint:'Tra theo biểu thuế hiện hành'},
  imp?{k:'vat',l:'Thuế suất GTGT (%)',w:3,type:'number'}:null,
  {k:'t1',l:imp?'Thuế nhập khẩu tạm tính (VND)':'Thuế xuất khẩu tạm tính (VND)',w:3,computed:1},
  imp?{k:'t2',l:'Thuế GTGT tạm tính (VND)',w:3,computed:1}:null
].filter(Boolean);

const FMT={
  mst:[/^\d{10}(-?\d{3})?$/,'Mã số thuế gồm 10 hoặc 13 chữ số'],
  iso2:[/^[A-Z]{2}$/,'Mã nước gồm 2 chữ cái in hoa'],
  iso3:[/^[A-Z]{3}$/,'Mã đồng tiền gồm 3 chữ cái in hoa'],
  hs8:[/^\d{8}$/,'Mã HS gồm đúng 8 chữ số'],
  kho:[/^[0-9A-Z]{7}$/,'Mã địa điểm lưu giữ gồm 7 ký tự chữ hoặc số'],
  loc:[/^[A-Z]{2}[A-Z0-9]{3}$/,'Mã địa điểm gồm 5 ký tự (2 chữ cái nước + 3 ký tự)'],
  hq:[/^[0-9A-Z]{4}$/,'Mã Chi cục gồm 4 ký tự chữ hoặc số'],
  tk:[/^(F|\d{11,12})$/,'Nhập “F” cho tờ khai đầu tiên, hoặc số tờ khai đầu tiên (11–12 chữ số) từ tờ thứ 2 trở đi']
};

/* ---------- trạng thái ---------- */
// Cách lưu bản nháp trong trình duyệt:
//  'session': giữ khi tải lại trang, TỰ MẤT khi đóng tab hoặc trình duyệt (sessionStorage)
//  'none'   : không lưu gì, tải lại trang là mất hết (chỉ giữ trong bộ nhớ của trang)
// Không dùng localStorage hay IndexedDB nên không để lại dữ liệu trên đĩa sau khi đóng trình duyệt.
const HQ_PERSIST='session';
const Mem={};
const Store={
  get(k){
    if(HQ_PERSIST==='session'){try{return sessionStorage.getItem(k)}catch(e){}}
    return Object.prototype.hasOwnProperty.call(Mem,k)?Mem[k]:null;
  },
  set(k,v){
    if(HQ_PERSIST==='session'){try{sessionStorage.setItem(k,v);return}catch(e){}}
    Mem[k]=v;
  },
  del(k){try{sessionStorage.removeItem(k)}catch(e){}delete Mem[k]}
};
// Xóa dữ liệu mà các phiên bản trước của trang đã ghi xuống localStorage/IndexedDB của trình duyệt
function purgeLegacyStorage(){
  ['hq-draft-v1','hq-review-pairs-v1','hq-review-meta-v1'].forEach(k=>{try{localStorage.removeItem(k)}catch(e){}});
  try{if(window.indexedDB&&indexedDB.deleteDatabase)indexedDB.deleteDatabase('hq-draft-files')}catch(e){}
}
purgeLegacyStorage();
const KEY='hq-draft-v1';
const blank=()=>({f:{dv_tl:'KGM',mt:'USD'},lines:[{}],chk:{},att:{},files:[],ai:{}});
let mode='IDA';
let store={IDA:blank(),EDA:blank()};
let showAll=false;
let SEC=build(mode);
try{const raw=Store.get(KEY);if(raw){const o=JSON.parse(raw);if(o&&o.store){store={...store,...o.store};mode=o.mode||'IDA';SEC=build(mode)}}}catch(e){}
const st=()=>store[mode];
let saveT;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{syncStoreFromForm();try{Store.set(KEY,JSON.stringify({mode,store}))}catch(e){}syncPairs()},300)}

/* ---------- lưu dữ liệu review dạng [key, value] (cùng cách lưu như bản nháp) ---------- */
const PAIRS_KEY='hq-review-pairs-v1',META_KEY='hq-review-meta-v1',NL=String.fromCharCode(10),QT=String.fromCharCode(34);
function pairsFor(m){
  const keep=mode;mode=m;
  const s=store[m],imp=m==='IDA',out=[],meta={};
  const put=(k,v,info)=>{out.push([k,String(v==null?'':v)]);meta[k]=info};
  try{
    const c=calc();
    build(m).forEach(sec=>{(sec.fields||[]).forEach(fd=>{
      const k=m+'.f.'+fd.k;
      const v=fd.computed?(c.tot?c.tot:''):(s.f[fd.k]==null?'':s.f[fd.k]);
      const info={label:fd.l,section:sec.title,required:!!fd.req,derived:!!fd.computed};
      const op=fd.opts||(fd.list&&L[fd.list]);if(op)info.options=op;
      put(k,v,info);
    })});
    s.lines.forEach((l,i)=>{LINEF(imp).forEach(fd=>{
      const k=m+'.lines.'+i+'.'+fd.k;
      const info={label:'Dòng hàng '+(i+1)+' – '+fd.l,section:'Danh sách hàng',required:!!fd.req,derived:!!fd.computed};
      const op=fd.opts||(fd.list&&L[fd.list]);if(op)info.options=op;
      put(k,l[fd.k]==null?'':l[fd.k],info);
    })});
    ATT.forEach((a,i)=>put(m+'.att.'+i,s.att[i]?'1':'0',{label:'Chứng từ đính kèm: '+a,section:'Chứng từ đính kèm và ghi chú',required:false,derived:false}));
    (s.files||[]).forEach((fl,i)=>{
      const base=m+'.files.'+i+'.',sc='Chứng từ đính kèm và ghi chú',nm='Tệp đính kèm '+(i+1)+' – ';
      put(base+'name',fl.name,{label:nm+'Tên tệp',section:sc,required:false,derived:false});
      put(base+'type',(fl.type===''||fl.type==null)?'':ATT[fl.type],{label:nm+'Loại chứng từ',section:sc,required:false,derived:false,options:ATT.map(a=>[a,a])});
      put(base+'size',fl.size,{label:nm+'Dung lượng (byte)',section:sc,required:false,derived:true});
    });
    const cs=[['tong_tri_gia_hd',c.tot,'Tổng trị giá hóa đơn (ngoại tệ)'],['tong_tri_gia_tinh_thue_vnd',c.base,'Tổng trị giá tính thuế (VND)'],['thue_nk_xk_vnd',c.s1,imp?'Thuế nhập khẩu tạm tính (VND)':'Thuế xuất khẩu tạm tính (VND)']];
    if(imp)cs.push(['thue_gtgt_vnd',c.s2,'Thuế GTGT tạm tính (VND)']);
    cs.push(['tong_thue_vnd',c.s1+c.s2,'Tổng thuế tạm tính (VND)']);
    cs.forEach(x=>put(m+'.calc.'+x[0],x[1],{label:x[2],section:'Tổng hợp tạm tính',required:false,derived:true}));
  }finally{mode=keep}
  return {out,meta};
}
// Nguồn dữ liệu duy nhất là các ô đã nhập trên form khai báo: đọc trực tiếp từ DOM và đồng bộ ngược vào state
function syncStoreFromForm(){
  const s=st(),imp=mode==='IDA';
  SEC.forEach(sec=>(sec.fields||[]).forEach(fd=>{
    if(fd.computed)return;
    const el=document.getElementById('f-'+fd.k);if(!el)return;
    let v=ctlVal(el);if(fd.up)v=v.toUpperCase();
    s.f[fd.k]=v;
  }));
  const LF=LINEF(imp);
  s.lines.forEach((l,i)=>LF.forEach(fd=>{
    if(fd.computed)return;
    const el=document.getElementById('l-'+i+'-'+fd.k);if(!el)return;
    let v=ctlVal(el);if(fd.up)v=v.toUpperCase();
    l[fd.k]=v;
  }));
  ATT.forEach((a,i)=>{const el=document.getElementById('att-'+i);if(el)s.att[i]=el.checked});
}
let memPairs=[],memMeta={fields:{}};
function syncPairs(){
  syncStoreFromForm();
  let a,b;
  try{a=pairsFor('IDA');b=pairsFor('EDA')}catch(e){console.error(e);return}
  memPairs=a.out.concat(b.out);
  memMeta={updated:new Date().toISOString(),activeMode:mode,fields:Object.assign({},a.meta,b.meta)};
  try{Store.set(PAIRS_KEY,JSON.stringify(memPairs));Store.set(META_KEY,JSON.stringify(memMeta))}catch(e){}
  try{window.dispatchEvent(new CustomEvent('hq-review-updated',{detail:{count:memPairs.length}}))}catch(e){}
}
function getPairs(m){const arr=memPairs;return m?arr.filter(p=>p[0].indexOf(m+'.')===0):arr.slice()}
function getMeta(){return memMeta}
function csvCell(v){v=String(v==null?'':v);return(v.indexOf(',')>-1||v.indexOf(QT)>-1||v.indexOf(NL)>-1)?QT+v.split(QT).join(QT+QT)+QT:v}
function toCSV(m){const meta=(getMeta().fields)||{};return ['key,value,label,section,required'].concat(getPairs(m).map(p=>{const i=meta[p[0]]||{};return [p[0],p[1],i.label,i.section,i.required?'1':'0'].map(csvCell).join(',')})).join(NL)}
window.hqReview={PAIRS_KEY,META_KEY,getPairs,getMeta,toCSV,sync:syncPairs,getFile:id=>fileCache.has(id)?Promise.resolve(fileCache.get(id)):FileDB.get(id)};

/* ---------- tính toán ---------- */
function calc(){
  const s=st(),f=s.f,imp=mode==='IDA';
  let ty=num(f.ty_gia);
  if(!ty&&String(f.mt||'').trim().toUpperCase()==='VND')ty=1;   // hóa đơn bằng VND thì không cần tỷ giá
  let tot=0;
  s.lines.forEach(l=>{l.tt=Math.round(num(l.sl)*num(l.dg)*100)/100;tot+=l.tt});
  tot=Math.round(tot*100)/100;
  const fees=imp?num(f.vc_phi)+num(f.bh_phi)+num(f.dc_cong)-num(f.dc_tru):0;
  let base=0,s1=0,s2=0;
  s.lines.forEach(l=>{
    const share=tot?l.tt/tot:0;
    const b=Math.round((l.tt+fees*share)*ty);
    l.base=b;
    l.t1=Math.round(b*num(l.ts)/100);
    l.t2=imp?Math.round((b+l.t1)*num(l.vat)/100):0;
    base+=b;s1+=l.t1;s2+=l.t2;
  });
  return {tot,fees,base,s1,s2,ty};
}

/* ---------- soát lỗi ---------- */
function validate(){
  const s=st(),f=s.f,imp=mode==='IDA',out=[];
  const add=(sev,sec,id,msg,o={})=>out.push({sev,sec,id,msg,...o});
  const val=k=>String(f[k]??'').trim();
  SEC.forEach(sec=>{
    (sec.fields||[]).forEach(fd=>{
      if(fd.computed)return;
      const v=val(fd.k),id='f-'+fd.k;
      if(fd.req&&!v){add('err',sec.id,id,'Chưa nhập “'+fd.l+'”',{empty:1});return}
      if(!v)return;
      if(fd.fmt&&!FMT[fd.fmt][0].test(v))add('err',sec.id,id,fd.l+': '+FMT[fd.fmt][1]);
      if(fd.nd&&hasDia(v))add('warn',sec.id,id,fd.l+': có dấu tiếng Việt. VNACCS chỉ nhận chữ không dấu, viết hoa',{fix:()=>{f[fd.k]=noDiacritics(f[fd.k]);}});
      if(fd.type==='number'&&num(v)<=0&&['so_kien','tl_gross','ty_gia'].includes(fd.k))add('err',sec.id,id,fd.l+' phải lớn hơn 0');
      if(fd.int&&!Number.isInteger(num(v)))add('err',sec.id,id,fd.l+' phải là số nguyên');
    });
  });
  const today=new Date().toISOString().slice(0,10);
  if(val('hd_ngay')&&val('hd_ngay')>today)add('warn','hd','f-hd_ngay','Ngày phát hành hóa đơn nằm trong tương lai');
  if(val('hdong_ngay')&&val('hdong_hh')&&val('hdong_hh')<val('hdong_ngay'))add('err','hdong','f-hdong_hh','Ngày hết hạn hợp đồng sớm hơn ngày hợp đồng');
  if(val('hd_loai')==='A'&&!val('hd_so'))add('warn','hd','f-hd_so','Hóa đơn thương mại cần có số hóa đơn',{empty:1});
  if(f.pt_vc==='2'&&!val('so_cont'))add('warn','vc','f-so_cont','Vận chuyển bằng container nhưng chưa khai số container');
  if(imp&&['FOB','EXW','FCA','FAS'].includes(f.dk_gia)&&num(f.vc_phi)<=0)add('warn','tg','f-vc_phi','Điều kiện giá '+f.dk_gia+' chưa gồm cước vận tải quốc tế. Kiểm tra lại phí vận tải và bảo hiểm');
  if(imp&&['CIF','CIP'].includes(f.dk_gia)&&num(f.vc_phi)>0)add('warn','tg','f-vc_phi','Điều kiện giá '+f.dk_gia+' đã gồm cước. Nhập thêm phí vận tải có thể bị tính trùng');
  if(imp&&val('nk_ma')&&val('ut_ma')&&val('nk_ma')===val('ut_ma'))add('warn','nk','f-ut_ma','Mã người ủy thác trùng với mã người nhập khẩu');
  // chứng từ đính kèm
  const hasDoc=k=>!!s.att[k]||(s.files||[]).some(x=>String(x.type)===String(k));
  if(imp&&!hasDoc(0))add('warn','ct','sec-ct','Chưa có chứng từ “Hóa đơn thương mại”: chưa tích chọn và chưa tải tệp lên',{empty:1});
  if(val('vd_so')&&!hasDoc(2))add('warn','ct','sec-ct','Đã khai số vận đơn nhưng chưa có chứng từ “Vận đơn (B/L, AWB)”: chưa tích chọn và chưa tải tệp lên');
  // dòng hàng
  const LF=LINEF(imp);
  if(!s.lines.length)add('err','lines','sec-lines','Chưa có dòng hàng nào');
  if(s.lines.length>50)add('err','lines','sec-lines','Tờ khai có '+s.lines.length+' dòng hàng, vượt quá giới hạn 50 dòng. Hãy chia thành nhiều tờ khai');
  const seen={};
  s.lines.forEach((l,i)=>{
    LF.forEach(fd=>{
      if(fd.computed)return;
      const v=String(l[fd.k]??'').trim(),id='l-'+i+'-'+fd.k,nm='Dòng '+(i+1)+' – '+fd.l;
      if(fd.req&&!v){add('err','lines',id,'Chưa nhập “'+nm+'”',{empty:1});return}
      if(!v)return;
      if(fd.fmt&&!FMT[fd.fmt][0].test(v))add('err','lines',id,nm+': '+FMT[fd.fmt][1]);
      if(fd.nd&&hasDia(v))add('warn','lines',id,nm+': có dấu tiếng Việt. VNACCS chỉ nhận chữ không dấu, viết hoa',{fix:()=>{l[fd.k]=noDiacritics(l[fd.k]);}});
      if((fd.k==='sl'||fd.k==='dg')&&num(v)<=0)add('err','lines',id,nm+' phải lớn hơn 0');
    });
    if(String(l.ts??'').trim()==='')add('warn','lines','l-'+i+'-ts','Dòng '+(i+1)+': chưa nhập thuế suất. Kiểm tra biểu thuế theo mã HS');
    if(imp&&String(l.vat??'').trim()==='')add('warn','lines','l-'+i+'-vat','Dòng '+(i+1)+': chưa nhập thuế suất GTGT');
    const key=(l.hs||'')+'|'+(l.mota||'').trim().toUpperCase()+'|'+(l.xx||'');
    if(l.hs&&seen[key]!=null)add('warn','lines','l-'+i+'-hs','Dòng '+(i+1)+' trùng mã HS, mô tả và xuất xứ với dòng '+(seen[key]+1)+'. Có thể gộp dòng');
    else if(l.hs)seen[key]=i;
  });
  return out;
}

/* ---------- tải chứng từ đính kèm ---------- */
const MAX_FILE=10*1024*1024,MAX_FILES=30,EXT_OK=['pdf','jpg','jpeg','png','xls','xlsx','doc','docx','xml'];
const fileCache=new Map();   // id -> File (chỉ trong bộ nhớ của trang)
// File chứng từ chỉ giữ trong bộ nhớ của trang (không ghi xuống đĩa): tải lại trang hoặc đóng trình duyệt là mất.
const FileDB={
  put(id,blob){return Promise.resolve()},
  get(id){return Promise.resolve(fileCache.get(id))},
  del(id){return Promise.resolve()}
};
function fmtSize(b){return b<1024?b+' B':b<1048576?fmtN(b/1024,0)+' KB':fmtN(b/1048576,1)+' MB'}
function guessType(name){
  const n=noDiacritics(name).toLowerCase().replace(/\.[a-z0-9]+$/,'');
  const t=n.split(/[^a-z0-9]+/).filter(Boolean);
  if(n.includes('hoa don')||t.includes('invoice')||t.includes('inv'))return 0;
  if(n.includes('packing')||n.includes('pklist')||n.includes('packlist')||t.some(x=>x==='pl'||x==='pkl'||x==='plist'||x==='pklist'||x==='packlist'))return 1;
  if(n.includes('van don')||n.includes('lading')||t.includes('bl')||t.includes('awb')||t.includes('bol'))return 2;
  if(n.includes('hop dong')||n.includes('contract'))return 3;
  if(t.includes('co')||n.includes('xuat xu')||n.includes('origin'))return 4;
  if(n.includes('giay phep')||n.includes('license')||n.includes('permit'))return 5;
  return 7;
}
function fileMsg(t){const e=$('#fileMsg');if(e)e.textContent=t||''}
function tickAtt(k){
  if(k===''||k==null)return;
  st().att[k]=true;
  const el=document.getElementById('att-'+k);if(el)el.checked=true;
}
function addFiles(list,hint){
  const s=st();s.files=s.files||[];
  const msgs=[];
  Array.from(list||[]).forEach(f=>{
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    if(EXT_OK.indexOf(ext)<0){msgs.push('Bỏ qua “'+f.name+'”: định dạng .'+ext+' chưa được hỗ trợ');return}
    if(f.size>MAX_FILE){msgs.push('Bỏ qua “'+f.name+'”: vượt '+fmtSize(MAX_FILE));return}
    if(s.files.some(x=>x.name===f.name&&x.size===f.size)){msgs.push('Bỏ qua “'+f.name+'”: đã có trong danh sách');return}
    if(s.files.length>=MAX_FILES){msgs.push('Đã đủ '+MAX_FILES+' tệp');return}
    const id='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),t=(hint&&hint[f.name]!=null)?hint[f.name]:guessType(f.name);
    s.files.push({id:id,name:f.name,size:f.size,mime:f.type||'',type:t});
    fileCache.set(id,f);
    FileDB.put(id,f).catch(()=>fileMsg('Không lưu bền được nội dung tệp trong trình duyệt. Tệp chỉ được giữ đến khi tải lại trang.'));
    tickAtt(t);
  });
  fileMsg(msgs.join('. '));
  renderFiles();refresh();save();
}
function removeFile(id){
  const s=st();
  s.files=(s.files||[]).filter(x=>x.id!==id);
  fileCache.delete(id);FileDB.del(id).catch(()=>{});
  renderFiles();refresh();save();
}
function renderFiles(){
  const host=$('#fileList');if(!host)return;
  const s=st();host.innerHTML='';
  (s.files||[]).forEach(fl=>{
    const sel=h('select',{'aria-label':'Loại chứng từ của '+fl.name},h('option',{value:''},'Chọn loại chứng từ…'),ATT.map((a,k)=>h('option',{value:String(k)},a)));
    sel.value=(fl.type===''||fl.type==null)?'':String(fl.type);
    sel.addEventListener('change',()=>{fl.type=sel.value===''?'':Number(sel.value);tickAtt(fl.type);refresh();save()});
    const row=h('div',{class:'frow'},
      h('span',{class:'fn',title:fl.name},fl.name),
      h('span',{class:'fs'},fmtSize(fl.size)),sel,
      h('button',{class:'btn small danger',type:'button',onclick:()=>removeFile(fl.id)},'Xóa'));
    host.append(row);
    if(!fileCache.has(fl.id)){
      const miss=()=>{row.classList.add('miss');row.append(h('div',{class:'fm'},'Trình duyệt này chưa có nội dung tệp. Hãy chọn lại tệp để đính kèm.'))};
      FileDB.get(fl.id).then(b=>{if(b)fileCache.set(fl.id,b);else miss()}).catch(miss);
    }
  });
}
function uploadUI(){
  const wrap=h('div',{style:'margin-bottom:18px'});
  wrap.append(h('p',{style:'margin:0 0 8px;font-weight:600;font-size:13px'},'Tải chứng từ đính kèm lên'));
  const inp=h('input',{type:'file',id:'fileIn',multiple:true,accept:'.pdf,.jpg,.jpeg,.png,.xls,.xlsx,.doc,.docx,.xml'});
  const drop=h('label',{class:'drop',for:'fileIn'},
    h('b',{},'Kéo thả tệp vào đây hoặc bấm để chọn'),
    h('span',{},'PDF, JPG, PNG, Excel, Word, XML. Tối đa '+fmtSize(MAX_FILE)+' mỗi tệp, '+MAX_FILES+' tệp. Đây là giới hạn do trang này đặt ra, hãy kiểm tra giới hạn thực tế khi đính kèm trong ECUS5/VNACCS.'),
    inp);
  inp.addEventListener('change',()=>{addFiles(inp.files);inp.value=''});
  ['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over')}));
  ['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over')}));
  drop.addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files)addFiles(e.dataTransfer.files)});
  wrap.append(drop,h('div',{id:'fileList'}),h('div',{class:'msg warn',id:'fileMsg',role:'status'}));
  setTimeout(renderFiles,0);
  return wrap;
}

/* ---------- dựng giao diện ---------- */
function listOf(name){return L[name].map(x=>Array.isArray(x)?x[0]:x)}
function buildDatalists(){
  document.querySelectorAll('datalist').forEach(d=>d.remove());
  ['ihinh','ehinh','dvkien','dvt','tien'].forEach(n=>{
    const d=h('datalist',{id:'dl-'+n});
    L[n].forEach(x=>{const [v,t]=Array.isArray(x)?x:[x,''];d.append(h('option',{value:v},t))});
    document.body.append(d);
  });
}
function ctlVal(el){
  if(el.dataset&&el.dataset.combo==='1'&&el.value==='__x'){const x=document.getElementById(el.id+'-x');return x?x.value:''}
  return el.value;
}
function comboControl(fd,id,get,set){
  const items=L[fd.list].map(x=>Array.isArray(x)?x:[x,x]);
  const sel=h('select',{id:id,'data-combo':'1'},
    h('option',{value:''},'Chọn…'),
    items.map(it=>h('option',{value:it[0]},it[0]===it[1]?it[0]:it[0]+' – '+it[1])),
    h('option',{value:'__x'},'Khác (nhập mã khác)…'));
  const x=h('input',{id:id+'-x',type:'text',autocomplete:'off',spellcheck:'false',placeholder:'Nhập mã',maxlength:fd.max||null,class:'up',style:'margin-top:6px'});
  const cur=String(get()==null?'':get());
  if(cur==='')sel.value='';
  else if(items.some(it=>it[0]===cur))sel.value=cur;
  else{sel.value='__x';x.value=cur}
  x.hidden=sel.value!=='__x';
  const push=()=>{set(sel.value==='__x'?x.value.toUpperCase():sel.value);refresh();save()};
  sel.addEventListener('change',()=>{x.hidden=sel.value!=='__x';if(!x.hidden)x.focus();push()});
  x.addEventListener('input',push);
  return h('div',{class:'combo'},sel,x);
}
function control(fd,id,get,set){
  if(fd.list)return comboControl(fd,id,get,set);
  let el;
  const v=get();
  if(fd.type==='select'){
    el=h('select',{id},h('option',{value:''},'Chọn…'),fd.opts.map(o=>h('option',{value:o[0]},o[1])));
    el.value=v??'';
  }else if(fd.type==='area'){
    el=h('textarea',{id,maxlength:fd.max});el.value=v??'';
  }else{
    el=h('input',{id,type:fd.type==='number'?'number':fd.type==='date'?'date':'text',autocomplete:'off',spellcheck:'false'});
    if(fd.type==='number'){el.step='any';el.min='0';el.inputMode='decimal'}
    if(fd.max)el.maxLength=fd.max;
    if(fd.list)el.setAttribute('list','dl-'+fd.list);
    if(fd.up)el.classList.add('up');
    if(fd.computed){el.readOnly=true;el.tabIndex=-1}
    el.value=v??'';
  }
  if(!fd.computed){
    const ev=el.tagName==='SELECT'?'change':'input';
    el.addEventListener(ev,()=>{let x=el.value;if(fd.up&&typeof x==='string'){x=x.toUpperCase()}set(x);refresh();save()});
  }
  return el;
}
function fieldBox(fd,id,get,set){
  const box=h('div',{class:'fld w'+(fd.w||4),'data-id':id});
  box.append(h('label',{for:id},fd.l,fd.req?h('span',{class:'req','aria-hidden':'true'},'*'):null));
  const aiMark=(st().ai||{})[id];
  if(aiMark){
    box.classList.add('aifill');
    box.title='AI điền'+(aiMark.nguon?' từ: '+aiMark.nguon:'')+(aiMark.tc?' (độ tin cậy: '+tcLabel(aiMark.tc)+')':'');
  }
  const set2=v=>{
    set(v);
    const a=st().ai;
    if(a&&a[id]){delete a[id];box.classList.remove('aifill');box.removeAttribute('title')}
  };
  box.append(control(fd,id,get,set2));
  if(fd.hint)box.append(h('div',{class:'hint'},fd.hint));
  box.append(h('div',{class:'msgs'}));
  return box;
}
function sectionShell(sec,withCheck=true){
  const s=h('section',{class:'sheet',id:'sec-'+sec.id});
  const hd=h('header',{},h('h2',{},sec.title));
  if(withCheck){
    const c=h('input',{type:'checkbox',id:'chk-'+sec.id});
    c.checked=!!st().chk[sec.id];
    c.addEventListener('change',()=>{st().chk[sec.id]=c.checked;refresh();save()});
    hd.append(h('label',{class:'chk'},c,'Đã soát phần này'));
  }
  if(sec.desc)hd.append(h('p',{},sec.desc));
  s.append(hd);
  return s;
}
function clearLineAI(){const a=st().ai;if(a)Object.keys(a).forEach(k=>{if(k.indexOf('l-')===0)delete a[k]})}
function renderLines(host){
  const imp=mode==='IDA',LF=LINEF(imp),s=st();
  host.innerHTML='';
  s.lines.forEach((l,i)=>{
    const card=h('div',{class:'line'});
    card.append(h('div',{class:'lh'},h('span',{},'Dòng hàng '+(i+1)),h('span',{class:'t'},
      h('button',{class:'btn small',type:'button',onclick:()=>{clearLineAI();s.lines.splice(i+1,0,{...l});renderLines(host);refresh();save()}},'Nhân bản'),
      h('button',{class:'btn small danger',type:'button',onclick:()=>{clearLineAI();s.lines.splice(i,1);if(!s.lines.length)s.lines.push({});renderLines(host);refresh();save()}},'Xóa'))));
    const g=h('div',{class:'grid'});
    LF.forEach(fd=>g.append(fieldBox(fd,'l-'+i+'-'+fd.k,()=>l[fd.k],v=>{l[fd.k]=v})));
    card.append(g);host.append(card);
  });
  host.append(h('button',{class:'btn',type:'button',onclick:()=>{if(s.lines.length>=50){toast('Tờ khai tối đa 50 dòng hàng');return}s.lines.push({});renderLines(host);refresh();save()}},'+ Thêm dòng hàng'));
}
function render(){
  const main=$('#main');main.innerHTML='';
  buildDatalists();
  main.append(h('div',{class:'notice'},
    h('strong',{},'Công cụ soát nháp độc lập. '),
    'Trang này không kết nối hệ thống Hải quan và không thay thế việc khai chính thức. Bố cục trường theo màn hình '+(mode==='IDA'?'IDA':'EDA')+' trên VNACCS/VCIS và Phụ lục II Thông tư 38/2015/TT-BTC cùng các văn bản sửa đổi. Hãy đối chiếu bảng mã và chỉ tiêu với phiên bản mới nhất trong ứng dụng khai báo trước khi gửi. Dữ liệu chỉ lưu trong trình duyệt của bạn.'));
  SEC.forEach(sec=>{
    if(sec.type==='review'){
      const s=sectionShell(sec,false);s.append(h('div',{class:'body',id:'reviewBody'}));main.append(s);return;
    }
    const s=sectionShell(sec);
    const body=h('div',{class:'body'});
    if(sec.type==='lines'){
      const host=h('div',{id:'linesHost'});body.append(host,h('div',{class:'totals',id:'totals'}));
      s.append(body);main.append(s);renderLines(host);return;
    }
    if(sec.type==='att'){
      body.append(uploadUI());
      const box=h('div',{class:'atts'});
      ATT.forEach((a,i)=>{const c=h('input',{type:'checkbox',id:'att-'+i});c.checked=!!st().att[i];c.addEventListener('change',()=>{st().att[i]=c.checked;refresh();save()});box.append(h('label',{},c,a))});
      body.append(h('p',{style:'margin:0 0 8px;font-weight:600;font-size:13px'},'Loại chứng từ sẽ đính kèm khi gửi tờ khai (tự tích khi bạn tải tệp tương ứng lên)'),box);
    }
    const g=h('div',{class:'grid'});
    sec.fields.forEach(fd=>g.append(fieldBox(fd,'f-'+fd.k,()=>st().f[fd.k],v=>{st().f[fd.k]=v})));
    body.append(g);s.append(body);main.append(s);
  });
  refresh();
}

/* ---------- cập nhật phần phụ thuộc ---------- */
function setVal(id,v){const e=document.getElementById(id);if(e&&e.value!==v)e.value=v}
function refresh(){
  const s=st(),imp=mode==='IDA';
  const c=calc();
  setVal('f-hd_tong',c.tot?fmtN(c.tot,2)+' '+(s.f.mt||''):'');
  s.lines.forEach((l,i)=>{
    setVal('l-'+i+'-tt',l.tt?fmtN(l.tt,2):'');
    setVal('l-'+i+'-t1',l.base?fmtN(l.t1):'');
    {const need=!c.ty&&c.tot>0;['t1','t2'].forEach(k=>{const e=document.getElementById('l-'+i+'-'+k);if(e)e.placeholder=need?'Cần tỷ giá':''})}
    if(imp)setVal('l-'+i+'-t2',l.base?fmtN(l.t2):'');
  });
  const T=$('#totals');
  if(T){
    T.innerHTML='';
    const noRate=!c.ty&&c.tot>0;
    if(noRate){
      T.append(h('div',{class:'tot note'},
        h('b',{},'Chưa tính được thuế: thiếu tỷ giá tính thuế'),
        h('small',{},'Trị giá tính thuế và các khoản thuế đang để trống vì chưa nhập “Tỷ giá tính thuế” (VND / 1 đơn vị ngoại tệ) ở phần Hóa đơn và thanh toán. Nếu hóa đơn bằng VND, hãy chọn mã đồng tiền VND, hệ thống sẽ tự dùng tỷ giá 1.'),
        h('button',{class:'btn small',type:'button',onclick:()=>jump('f-ty_gia')},'Đi tới ô tỷ giá')));
    }
    const money=v=>noRate?'Chưa tính':fmtN(v);
    const add=(a,b,big)=>T.append(h('div',{class:'tot'+(big?' big':'')},h('small',{},a),h('b',{},b)));
    add('Tổng trị giá hóa đơn',fmtN(c.tot,2)+' '+(s.f.mt||''));
    add(imp?'Tổng trị giá tính thuế (VND)':'Tổng trị giá tính thuế XK (VND)',money(c.base));
    add(imp?'Thuế nhập khẩu tạm tính (VND)':'Thuế xuất khẩu tạm tính (VND)',money(c.s1));
    if(imp)add('Thuế GTGT tạm tính (VND)',money(c.s2));
    add('Tổng thuế tạm tính (VND)',money(c.s1+c.s2),true);
  }
  const issues=validate();
  window._issues=issues;
  // thông báo từng ô
  document.querySelectorAll('.fld').forEach(b=>{b.classList.remove('bad','warned');b.querySelector('.msgs').innerHTML=''});
  issues.forEach(is=>{
    if(is.empty&&!showAll)return;
    const b=document.querySelector('.fld[data-id="'+is.id+'"]');if(!b)return;
    b.classList.add(is.sev==='err'?'bad':'warned');
    if(is.sev==='err'&&b.classList.contains('warned'))b.classList.remove('warned');
    b.querySelector('.msgs').append(h('div',{class:'msg '+is.sev},is.msg));
  });
  // thanh bên + viền phần
  const nav=$('#nav');nav.innerHTML='';
  const real=SEC.filter(x=>x.type!=='review');
  const done=real.filter(x=>s.chk[x.id]).length;
  nav.append(h('div',{class:'progress'},h('div',{style:'font-size:13px;font-weight:600'},'Đã soát '+done+'/'+real.length+' phần'),h('div',{class:'bar'},h('i',{style:'width:'+(done/real.length*100)+'%'}))));
  SEC.forEach(sec=>{
    const mine=issues.filter(i=>i.sec===sec.id&&(showAll||!i.empty));
    const ne=mine.filter(i=>i.sev==='err').length,nw=mine.length-ne;
    const el=document.getElementById('sec-'+sec.id);
    if(el){el.classList.toggle('reviewed',!!s.chk[sec.id]);el.classList.toggle('has-err',ne>0);el.classList.toggle('has-warn',!ne&&nw>0)}
    let b=null;
    if(sec.type==='review'){const all=issues.filter(i=>showAll||!i.empty);b=all.length?h('span',{class:'badge '+(all.some(i=>i.sev==='err')?'err':'warn')},all.length):null}
    else if(ne)b=h('span',{class:'badge err',title:ne+' lỗi'},ne);
    else if(nw)b=h('span',{class:'badge warn',title:nw+' cảnh báo'},nw);
    else if(s.chk[sec.id])b=h('span',{class:'badge ok'},'✓');
    nav.append(h('a',{onclick:()=>go('sec-'+sec.id)},sec.title,b));
  });
  renderReview(issues,c);
}
function go(id){const e=document.getElementById(id);if(e)e.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'start'})}
function jump(id){
  const e=document.getElementById(id);
  if(e){e.scrollIntoView({behavior:reduceMotion?'auto':'smooth',block:'center'});setTimeout(()=>e.focus&&e.focus({preventScroll:true}),250)}
  else go(id);
}

/* ---------- phần soát lỗi & bản xem trước ---------- */
function optLabel(fd,v){if(fd.opts){const o=fd.opts.find(x=>x[0]===v);return o?o[1]:v}
  if(fd.list&&(fd.list==='ihinh'||fd.list==='ehinh')){const o=L[fd.list].find(x=>x[0]===v);return o?v+' – '+o[1]:v}return v}
function renderReview(issues,c){
  const host=$('#reviewBody');if(!host)return;
  const s=st(),f=s.f,imp=mode==='IDA';
  host.innerHTML='';
  const shown=issues.filter(i=>showAll||!i.empty);
  const errs=shown.filter(i=>i.sev==='err'),warns=shown.filter(i=>i.sev==='warn');
  const row=h('div',{class:'row',style:'margin:0 0 12px'});
  row.append(h('span',{style:'font-weight:700'},showAll?(errs.length+' lỗi, '+warns.length+' cảnh báo'):'Chưa soát toàn bộ'),
    h('button',{class:'btn primary small',type:'button',onclick:()=>{showAll=true;refresh()}},'Soát lại toàn bộ'));
  const fixable=issues.filter(i=>i.fix);
  if(fixable.length)row.append(h('button',{class:'btn small',type:'button',onclick:()=>{fixable.forEach(i=>i.fix());render();save();toast('Đã bỏ dấu và viết hoa '+fixable.length+' trường')}},'Bỏ dấu & viết hoa tất cả ('+fixable.length+')'));
  host.append(row);
  if(showAll&&!shown.length){host.append(h('div',{class:'okbox'},'Không phát hiện lỗi hay cảnh báo. Hãy đối chiếu bản xem trước bên dưới với chứng từ gốc trước khi khai chính thức.'))}
  else if(shown.length){
    const ul=h('ul',{class:'issues'});
    [...errs,...warns].forEach(i=>{
      const sec=SEC.find(x=>x.id===i.sec);
      ul.append(h('li',{class:i.sev},h('span',{class:'tag'},i.sev==='err'?'LỖI':'LƯU Ý'),
        h('div',{class:'tx'},i.msg,h('small',{},sec?sec.title:'')),
        i.fix?h('button',{class:'btn small',type:'button',onclick:()=>{i.fix();render();save()}},'Bỏ dấu'):null,
        h('button',{class:'btn small',type:'button',onclick:()=>jump(i.id)},'Đi tới')));
    });
    host.append(ul);
  }
  // bản xem trước
  const doc=h('div',{class:'doc'});
  doc.append(h('div',{class:'stamp'},'BẢN NHÁP'),
    h('h3',{},imp?'Tờ khai hải quan nhập khẩu':'Tờ khai hải quan xuất khẩu'),
    h('div',{class:'dsub'},(imp?'Màn hình IDA':'Màn hình EDA')+' · chưa gửi lên hệ thống VNACCS/VCIS'));
  SEC.filter(x=>x.fields).forEach(sec=>{
    doc.append(h('h4',{},sec.title));
    const kv=h('dl',{class:'kv',style:'margin:0'});
    sec.fields.forEach(fd=>{
      let v=fd.computed?(c.tot?fmtN(c.tot,2)+' '+(f.mt||''):''):String(f[fd.k]??'').trim();
      if(v&&!fd.computed)v=optLabel(fd,v);
      kv.append(h('div',{},h('dt',{},fd.l),h('dd',{class:v?'':'empty'},v||'(trống)')));
    });
    doc.append(kv);
  });
  {
    doc.append(h('h4',{},'Chứng từ đính kèm'),h('div',{style:'font-size:13.5px'},ATT.filter((a,i)=>s.att[i]).join('; ')||'(chưa chọn)'),
      (s.files||[]).length?h('div',{style:'font-size:13px;color:var(--muted);margin-top:4px'},'Tệp đã tải lên: '+s.files.map(x=>x.name+' ('+(x.type===''||x.type==null?'chưa phân loại':ATT[x.type])+')').join('; ')):null);
  }
  doc.append(h('h4',{},'Danh sách hàng ('+s.lines.length+' dòng)'));
  const LF=LINEF(imp);
  const cols=imp?[['STT'],['Mã HS'],['Mô tả'],['Xuất xứ'],['Số lượng'],['ĐVT'],['Đơn giá'],['Trị giá HĐ'],['Thuế NK %'],['Thuế GTGT %'],['Thuế NK (VND)'],['Thuế GTGT (VND)']]
                :[['STT'],['Mã HS'],['Mô tả'],['Số lượng'],['ĐVT'],['Đơn giá'],['Trị giá HĐ'],['Thuế XK %'],['Thuế XK (VND)']];
  const tb=h('table',{class:'t'},h('thead',{},h('tr',{},cols.map(x=>h('th',{},x[0])))));
  const tbody=h('tbody');
  s.lines.forEach((l,i)=>{
    const cells=imp?[i+1,l.hs,l.mota,l.xx,l.sl,l.dv,l.dg,fmtN(l.tt||0,2),l.ts,l.vat,fmtN(l.t1||0),fmtN(l.t2||0)]
                   :[i+1,l.hs,l.mota,l.sl,l.dv,l.dg,fmtN(l.tt||0,2),l.ts,fmtN(l.t1||0)];
    tbody.append(h('tr',{},cells.map((x,j)=>h('td',{class:(j===0||j>=(imp?4:3))&&j!==(imp?5:4)?'n':''},x==null||x===''?'':String(x)))));
  });
  tb.append(tbody);doc.append(h('div',{class:'scroll'},tb));
  doc.append(h('h4',{},'Tổng hợp tạm tính'));
  const sum=h('dl',{class:'kv',style:'margin:0'});
  const kv=(a,b)=>sum.append(h('div',{},h('dt',{},a),h('dd',{},b)));
  kv('Tổng trị giá hóa đơn',fmtN(c.tot,2)+' '+(f.mt||''));
  if(imp)kv('Trị giá điều chỉnh/phí (ngoại tệ)',fmtN(c.fees,2));
  kv('Tổng trị giá tính thuế (VND)',fmtN(c.base));
  kv(imp?'Thuế nhập khẩu (VND)':'Thuế xuất khẩu (VND)',fmtN(c.s1));
  if(imp)kv('Thuế GTGT (VND)',fmtN(c.s2));
  kv('Tổng thuế tạm tính (VND)',fmtN(c.s1+c.s2));
  doc.append(sum,h('p',{style:'font-size:12.5px;color:var(--muted);margin:14px 0 0'},'Số thuế chỉ là ước tính để đối chiếu. Số thuế chính thức do hệ thống hải quan tính khi đăng ký tờ khai (chưa gồm thuế tiêu thụ đặc biệt, thuế bảo vệ môi trường, thuế chống bán phá giá…).'));
  host.append(doc);
}

/* ---------- import chứng từ và AI tự điền form ---------- */
const IMP={files:[],busy:false,undo:null,plan:null};
const IMP_EXT=['pdf','xlsx','xls','csv','docx','txt','jpg','jpeg','png'];
const IMP_MAX_FILES=15,IMP_MAX_BYTES=15*1024*1024,IMP_MAX_TEXT_FILE=40000,IMP_MAX_TEXT_TOTAL=120000,IMP_MAX_ATTACH=10*1024*1024;
const IMP_SHEET_MAX=100,IMP_SHEET_HEAD=40,IMP_SHEET_TAIL=15;   // sheet packing list dài hơn 100 dòng: giữ 40 dòng đầu và 15 dòng cuối
const IMP_DEFAULTS={dv_tl:'KGM',mt:'USD'};
const IMP_MIME={pdf:'application/pdf',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png'};
const IMP_EXCL=['so_tk_dau','ma_hq','ngay_dk','ngay_xk','ghi_chu'];
const LIBS={
  xlsx:{url:'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',get:()=>window.XLSX},
  mammoth:{url:'https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js',get:()=>window.mammoth},
  pdfjs:{url:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',get:()=>window.pdfjsLib,worker:'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js'}
};
const libCache={};
function loadLib(name){
  const L=LIBS[name];
  const ready=()=>{
    const v=L.get();
    if(v&&L.worker&&v.GlobalWorkerOptions&&!v.GlobalWorkerOptions.workerSrc)v.GlobalWorkerOptions.workerSrc=L.worker;
    return v;
  };
  if(ready())return Promise.resolve(ready());
  if(libCache[name])return libCache[name];
  libCache[name]=new Promise((res,rej)=>{
    const sc=document.createElement('script');
    sc.src=L.url;sc.async=true;
    sc.onload=()=>{const v=ready();if(v)res(v);else{delete libCache[name];rej(new Error('Thư viện đọc '+name+' đã tải nhưng không dùng được'))}};
    sc.onerror=()=>{delete libCache[name];rej(new Error('Không tải được thư viện '+name+' từ mạng (kiểm tra kết nối hoặc trình chặn nội dung)'))};
    document.head.append(sc);
  });
  return libCache[name];
}
function readBuf(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error||new Error('Không đọc được file'));r.readAsArrayBuffer(f)})}
function readTxt(f){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result||''));r.onerror=()=>rej(r.error||new Error('Không đọc được file'));r.readAsText(f)})}
async function toBase64(f){
  const b=new Uint8Array(await readBuf(f));let s='';const CH=0x8000;
  for(let i=0;i<b.length;i+=CH)s+=String.fromCharCode.apply(null,b.subarray(i,i+CH));
  return btoa(s);
}

// Nhận diện loại chứng từ từ tên sheet, tên file và tiêu đề ở đầu dòng trong nội dung (một file có thể chứa nhiều loại)
function detectDocTypes(x){
  const set=[];
  const add=i=>{if(i!==7&&i>=0&&set.indexOf(i)<0)set.push(i)};
  (x.sheets||[]).forEach(n=>add(guessType(n)));
  add(guessType(x.name));
  const t=String(x.text||'').toUpperCase();
  if(/^[\s,"]*(COMMERCIAL\s+)?INVOICE[\s,"]*$/m.test(t)||/^[\s,"]*COMMERCIAL\s+INVOICE/m.test(t))add(0);
  if(/^[\s,"]*PACKING\s+LIST/m.test(t))add(1);
  if(/^[\s,"]*(BILL\s+OF\s+LADING|SEA\s+WAYBILL)/m.test(t))add(2);
  if(/^[\s,"]*CERTIFICATE\s+OF\s+ORIGIN/m.test(t))add(4);
  return set.sort((a,b)=>a-b);
}

async function parseImportFile(x){
  const e=x.ext;
  try{
    if(e==='txt'||e==='csv'){x.text=await readTxt(x.file);x.kind='text'}
    else if(e==='xlsx'||e==='xls'){
      const X=await loadLib('xlsx');
      const wb=X.read(await readBuf(x.file),{type:'array'});
      const out=[];x.sheets=[];
      wb.SheetNames.forEach(n=>{
        let csv=X.utils.sheet_to_csv(wb.Sheets[n],{blankrows:false});
        if(!csv.trim())return;
        x.sheets.push(n);
        const ln=csv.split(NL);
        // Sheet packing list rất dài: giữ phần đầu và phần cuối (gồm dòng tổng), bỏ bớt dòng chi tiết ở giữa
        if(ln.length>IMP_SHEET_MAX&&/pk|pack|(^|[^a-z])pl([^a-z]|$)/i.test(n)){
          const cut=ln.length-IMP_SHEET_HEAD-IMP_SHEET_TAIL;
          csv=ln.slice(0,IMP_SHEET_HEAD).concat(['... (đã bỏ '+cut+' dòng chi tiết ở giữa, giữ '+IMP_SHEET_HEAD+' dòng đầu và '+IMP_SHEET_TAIL+' dòng cuối gồm dòng tổng)'],ln.slice(-IMP_SHEET_TAIL)).join(NL);
          x.note=(x.note||'')+' (sheet '+n+' đã rút gọn)';
        }
        out.push('### Sheet: '+n+NL+csv);
      });
      x.text=out.join(NL+NL);x.kind='text';
    }else if(e==='docx'){
      const m=await loadLib('mammoth');
      const r=await m.extractRawText({arrayBuffer:await readBuf(x.file)});
      x.text=r.value||'';x.kind='text';
    }else if(e==='pdf'){
      const P=await loadLib('pdfjs');
      const doc=await P.getDocument({data:new Uint8Array(await readBuf(x.file))}).promise;
      const n=Math.min(doc.numPages,30),pages=[];
      for(let i=1;i<=n;i++){
        const pg=await doc.getPage(i),tc=await pg.getTextContent();
        let s='';tc.items.forEach(it=>{s+=it.str+(it.hasEOL?NL:' ')});
        pages.push(s.trim());
      }
      const chars=pages.join('').length;
      if(chars<40*n){x.kind='attach';x.mime=IMP_MIME.pdf;x.status='PDF dạng ảnh scan: gửi nguyên file cho AI'}
      else{x.text=pages.map((t,i)=>'--- Trang '+(i+1)+' ---'+NL+t).join(NL);x.kind='text';if(doc.numPages>n)x.note=' (chỉ đọc '+n+' trang đầu)'}
    }else{x.kind='attach';x.mime=IMP_MIME[e];x.status='Ảnh: gửi nguyên file cho AI'}
    if(x.kind==='text'){
      if(!x.text.trim()){x.kind='error';x.status='File không có nội dung văn bản đọc được'}
      else{
        x.hints=detectDocTypes(x);
        x.status='Đã đọc '+fmtN(x.text.length)+' ký tự'
          +(x.sheets&&x.sheets.length>1?', '+x.sheets.length+' sheet ('+x.sheets.join(', ')+')':'')+(x.note||'')
          +(x.hints.length?'. Nhận diện: '+x.hints.map(i=>ATT[i]).join(', '):'');
      }
    }
  }catch(err){x.kind='error';x.status='Lỗi đọc file: '+(err&&err.message?err.message:err)}
}

function renderImpList(){
  const host=$('#iList');if(!host)return;
  host.innerHTML='';
  IMP.files.forEach(x=>{
    const st2=h('span',{class:'ist'+(x.kind==='error'?' bad':'')},x.kind==='reading'?'Đang đọc…':x.status);
    host.append(h('div',{class:'irow'},
      h('span',{class:'fn',title:x.name},x.name),
      h('span',{class:'fs'},fmtSize(x.size)),
      st2,
      h('button',{class:'btn small danger',type:'button',disabled:IMP.busy?true:null,onclick:()=>{IMP.files=IMP.files.filter(y=>y!==x);renderImpList()}},'Xóa')));
  });
}
async function addImportFiles(list){
  const msgs=[],fresh=[];
  Array.from(list||[]).forEach(f=>{
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    if(ext==='doc'){msgs.push('Bỏ qua “'+f.name+'”: định dạng .doc cũ chưa đọc được, hãy lưu thành .docx hoặc PDF');return}
    if(IMP_EXT.indexOf(ext)<0){msgs.push('Bỏ qua “'+f.name+'”: định dạng .'+ext+' chưa được hỗ trợ');return}
    if(f.size>IMP_MAX_BYTES){msgs.push('Bỏ qua “'+f.name+'”: vượt '+fmtSize(IMP_MAX_BYTES));return}
    if(IMP.files.some(y=>y.name===f.name&&y.size===f.size)){msgs.push('Bỏ qua “'+f.name+'”: đã có trong danh sách');return}
    if(IMP.files.length+fresh.length>=IMP_MAX_FILES){msgs.push('Tối đa '+IMP_MAX_FILES+' file mỗi lần phân tích');return}
    fresh.push({name:f.name,size:f.size,file:f,ext:ext,kind:'reading',status:'',text:'',mime:''});
  });
  $('#iMsg').textContent=msgs.join('. ');
  fresh.forEach(x=>IMP.files.push(x));
  renderImpList();
  for(const x of fresh){await parseImportFile(x);renderImpList()}
}

function schemaField(fd,sec){
  const o={key:fd.k,nhan:fd.l};
  if(sec)o.phan=sec;
  o.kieu=fd.type==='select'?'select':fd.type==='date'?'date':fd.type==='number'?'number':'text';
  if(fd.opts)o.ma_hop_le=fd.opts.map(x=>x[0]+' = '+x[1]);
  else if(fd.list)o.ma_goi_y=L[fd.list].map(x=>Array.isArray(x)?x[0]:x);
  if(fd.hint)o.huong_dan=fd.hint;
  if(fd.nd)o.khong_dau=true;
  return o;
}
function buildSchema(){
  const imp=mode==='IDA',fields=[];
  SEC.forEach(sec=>(sec.fields||[]).forEach(fd=>{
    if(fd.computed||IMP_EXCL.indexOf(fd.k)>-1)return;
    fields.push(schemaField(fd,sec.title));
  }));
  const lines=LINEF(imp).filter(fd=>!fd.computed).map(fd=>schemaField(fd,''));
  return {fields:fields,lines:lines};
}
function buildExtractPrompt(head,parts,attachNames){
  const sch=buildSchema();
  return head+NL+NL+'SCHEMA FORM (key hợp lệ cho fields và cho values của lines):'+NL+JSON.stringify(sch)
    +NL+NL+'DANH SÁCH LOẠI CHỨNG TỪ (dùng cho documents.loai): '+JSON.stringify(ATT)
    +NL+NL+(attachNames.length?'CÁC FILE ĐÍNH KÈM DẠNG ẢNH HOẶC PDF SCAN (hãy đọc trực tiếp từ nội dung đính kèm): '+attachNames.join('; ')+NL+NL:'')
    +'NỘI DUNG CÁC CHỨNG TỪ DẠNG VĂN BẢN:'+NL+(parts.join(NL+NL)||'(không có)');
}

function extractJSON(t){
  t=String(t||'').trim();
  const a=t.indexOf('{'),b=t.lastIndexOf('}');
  if(a<0||b<=a)throw new Error('AI không trả về JSON'+(aiNote||''));
  try{return JSON.parse(t.slice(a,b+1))}
  catch(e){throw new Error('AI trả về JSON không hợp lệ'+(aiNote||' (có thể bị cắt do hết số token tối đa)'))}
}
function normTC(t){t=String(t||'').toUpperCase();return(t==='CAO'||t==='THAP')?t:'TRUNG_BINH'}
function tcLabel(t){return t==='CAO'?'Cao':t==='THAP'?'Thấp':'Trung bình'}
function normValue(fd,raw){
  if(raw==null||typeof raw==='object')return null;
  let v=String(raw).trim();
  if(!v)return null;
  if(fd.type==='number'){
    v=v.split(' ').join('');
    if(!/^-?\d+(\.\d+)?$/.test(v)){const w=v.split(',').join('');if(/^-?\d+(\.\d+)?$/.test(w))v=w;else return null}
    if(parseFloat(v)<0)return null;
    return {value:String(parseFloat(v)),note:''};
  }
  if(fd.type==='date')return /^\d{4}-\d{2}-\d{2}$/.test(v)?{value:v,note:''}:null;
  if(fd.type==='select'){const o=fd.opts.find(x=>x[0].toUpperCase()===v.toUpperCase());return o?{value:o[0],note:''}:null}
  let note='';
  if(fd.nd){const nv=noDiacritics(v);if(nv!==v.toUpperCase())note='đã bỏ dấu';v=nv}
  else if(fd.up)v=v.toUpperCase();
  if(fd.max&&v.length>fd.max){v=v.slice(0,fd.max);note=(note?note+'; ':'')+'đã cắt còn '+fd.max+' ký tự'}
  return {value:v,note:note};
}
function lineSummary(v){return [v.hs,v.mota,v.sl?v.sl+' '+(v.dv||''):'',v.dg?'ĐG '+v.dg:''].filter(Boolean).join(' · ')}
function isBlankLine(l){return !Object.keys(l).some(k=>String(l[k]==null?'':l[k]).trim()!==''&&k!=='tt'&&k!=='base'&&k!=='t1'&&k!=='t2')}

function buildPlan(data){
  const s=st(),imp=mode==='IDA';
  const P={auto:[],conf:[],lineAuto:[],lineConf:[],docs:[],canh_bao:[],ignored:[]};
  const fds={};
  SEC.forEach(sec=>(sec.fields||[]).forEach(fd=>{if(!fd.computed&&IMP_EXCL.indexOf(fd.k)<0)fds[fd.k]=Object.assign({sec:sec.title},fd)}));
  const F=(data&&data.fields&&typeof data.fields==='object')?data.fields:{};
  Object.keys(F).forEach(k=>{
    const fd=fds[k];
    if(!fd){P.ignored.push(k);return}
    const it=F[k],raw=(it&&typeof it==='object')?it.value:it;
    const nv=normValue(fd,raw);
    if(nv==null){P.ignored.push(k);return}
    const cur=String(s.f[k]==null?'':s.f[k]).trim();
    if(cur===nv.value)return;
    const item={key:k,id:'f-'+k,label:fd.l,sec:fd.sec,value:nv.value,old:cur,note:nv.note,nguon:String((it&&it.nguon)||''),tc:normTC(it&&it.do_tin_cay),sel:false};
    const blank=cur===''||IMP_DEFAULTS[k]===cur;
    (blank&&item.tc!=='THAP'?P.auto:P.conf).push(item);
  });
  const LF=LINEF(imp).filter(fd=>!fd.computed);
  const AL=Array.isArray(data&&data.lines)?data.lines.slice(0,50):[];
  const hasData=s.lines.some(l=>!isBlankLine(l));
  AL.forEach(L0=>{
    const vals=(L0&&L0.values&&typeof L0.values==='object')?L0.values:(L0||{});
    const o={};
    LF.forEach(fd=>{const nv=normValue(fd,vals[fd.k]);if(nv!=null)o[fd.k]=nv.value});
    if(!Object.keys(o).length)return;
    const item={values:o,nguon:String((L0&&L0.nguon)||''),tc:normTC(L0&&L0.do_tin_cay),sel:false};
    (!hasData&&item.tc!=='THAP'?P.lineAuto:P.lineConf).push(item);
  });
  (Array.isArray(data&&data.documents)?data.documents:[]).forEach(d=>{
    const idx=ATT.indexOf(d&&d.loai);
    if(idx>-1)P.docs.push({file:String(d.file||''),idx:idx});
  });
  P.canh_bao=(Array.isArray(data&&data.canh_bao)?data.canh_bao:[]).map(String).filter(Boolean).slice(0,20);
  return P;
}
function applyFields(list){
  const s=st();s.ai=s.ai||{};
  list.forEach(it=>{s.f[it.key]=it.value;s.ai[it.id]={nguon:it.nguon,tc:it.tc}});
}
function applyLines(list,replace){
  const s=st();s.ai=s.ai||{};
  if(replace){Object.keys(s.ai).forEach(k=>{if(k.indexOf('l-')===0)delete s.ai[k]});s.lines=[]}
  else while(s.lines.length&&isBlankLine(s.lines[s.lines.length-1]))s.lines.pop();
  list.forEach(it=>{
    if(s.lines.length>=50)return;
    const i=s.lines.length;
    s.lines.push(Object.assign({},it.values));
    Object.keys(it.values).forEach(k=>{s.ai['l-'+i+'-'+k]={nguon:it.nguon,tc:it.tc}});
  });
  if(!s.lines.length)s.lines.push({});
}
function applyDocs(docs){
  const s=st();
  const seen={};
  docs.forEach(d=>{
    tickAtt(d.idx);
    const f=(s.files||[]).find(x=>x.name===d.file);
    if(f&&!seen[d.file]){f.type=d.idx;seen[d.file]=1}   // loại đầu tiên là loại chính của file
  });
}
function snapshotState(){const s=st();return JSON.stringify({f:s.f,lines:s.lines,att:s.att,ai:s.ai||{},files:s.files||[]})}
function commitImport(){
  const y=window.scrollY;
  render();save();
  try{window.scrollTo(0,y)}catch(e){}
}

function renderImpResult(){
  const host=$('#iResult');if(!host)return;
  host.innerHTML='';
  const P=IMP.plan;if(!P)return;
  const nConf=P.conf.length+P.lineConf.length;
  host.append(h('p',{style:'margin:14px 0 4px;font-weight:600'},'Đã tự điền '+P.auto.length+' trường'+(P.lineAuto.length?' và '+P.lineAuto.length+' dòng hàng':'')+'. '+(nConf?nConf+' mục cần bạn xác nhận.':'Không có mục cần xác nhận.')));
  host.append(h('p',{style:'margin:0 0 8px;font-size:13px;color:var(--muted)'},'Các ô do AI điền có nền tím nhạt trên form (rê chuột để xem nguồn trích); màu này mất khi bạn sửa ô đó. Hãy đối chiếu với chứng từ gốc.'));
  if(P.docs.length){
    const byFile={};P.docs.forEach(d=>{(byFile[d.file]=byFile[d.file]||[]).push(ATT[d.idx])});
    host.append(h('p',{style:'margin:0 0 8px;font-size:13px'},h('b',{},'Loại chứng từ đã nhận diện và tick: '),Object.keys(byFile).map(f=>f+' → '+byFile[f].join(' + ')).join('; ')));
  }
  const table=(head,rows)=>h('div',{class:'scroll',style:'margin-bottom:12px'},h('table',{class:'t'},h('thead',{},h('tr',{},head.map(x=>h('th',{},x)))),h('tbody',{},rows)));
  const sub=t=>h('h3',{style:'margin:12px 0 6px;font-size:14px'},t);
  if(P.auto.length||P.lineAuto.length){
    host.append(sub('Đã điền vào form'));
    const rows=P.auto.map(it=>h('tr',{},h('td',{},it.sec+' – '+it.label),h('td',{},it.value+(it.note?' ('+it.note+')':'')),h('td',{},it.nguon),h('td',{},tcLabel(it.tc))));
    P.lineAuto.forEach((it,i)=>rows.push(h('tr',{},h('td',{},'Danh sách hàng – dòng '+(i+1)),h('td',{},lineSummary(it.values)),h('td',{},it.nguon),h('td',{},tcLabel(it.tc)))));
    host.append(table(['Trường','Giá trị','Nguồn','Độ tin cậy'],rows));
  }
  if(nConf){
    host.append(sub('Cần xác nhận (khác giá trị đang có, hoặc độ tin cậy thấp)'));
    const rows=[];
    const chk=it=>{const c=h('input',{type:'checkbox','aria-label':'Áp dụng mục này'});c.checked=!!it.sel;c.addEventListener('change',()=>{it.sel=c.checked});return c};
    P.conf.forEach(it=>rows.push(h('tr',{},h('td',{},chk(it)),h('td',{},it.sec+' – '+it.label),h('td',{},it.old||'(trống)'),h('td',{},it.value+(it.note?' ('+it.note+')':'')),h('td',{},it.nguon),h('td',{},tcLabel(it.tc)))));
    P.lineConf.forEach((it,i)=>rows.push(h('tr',{},h('td',{},chk(it)),h('td',{},'Thêm dòng hàng mới'),h('td',{},'—'),h('td',{},lineSummary(it.values)),h('td',{},it.nguon),h('td',{},tcLabel(it.tc)))));
    host.append(table(['Chọn','Trường','Hiện tại','AI đề xuất','Nguồn','Độ tin cậy'],rows));
    host.append(h('div',{class:'row',style:'margin-top:0'},h('button',{class:'btn primary',type:'button',onclick:applySelected},'Áp dụng mục đã chọn')));
  }
  if(P.canh_bao.length){host.append(sub('Cảnh báo từ AI'),h('ul',{style:'margin:0 0 8px;padding-left:20px;font-size:14px'},P.canh_bao.map(x=>h('li',{},x))))}
  if(P.ignored.length)host.append(h('p',{class:'hint'},'Bỏ qua '+P.ignored.length+' giá trị không hợp lệ hoặc không có trên form: '+P.ignored.slice(0,12).join(', ')));
  host.append(h('div',{class:'row'},h('button',{class:'btn danger',type:'button',onclick:undoImport},'Hoàn tác tất cả')));
}
function applySelected(){
  const P=IMP.plan;if(!P)return;
  const f=P.conf.filter(x=>x.sel),ln=P.lineConf.filter(x=>x.sel);
  if(!f.length&&!ln.length){$('#iMsg').textContent='Chưa chọn mục nào để áp dụng.';return}
  applyFields(f);
  if(ln.length)applyLines(ln,false);
  P.auto=P.auto.concat(f);P.lineAuto=P.lineAuto.concat(ln);
  P.conf=P.conf.filter(x=>!x.sel);P.lineConf=P.lineConf.filter(x=>!x.sel);
  commitImport();renderImpResult();
  $('#iMsg').textContent='Đã áp dụng '+(f.length+ln.length)+' mục.';
}
function undoImport(){
  if(!IMP.undo)return;
  const s=st(),o=JSON.parse(IMP.undo),keep=new Set((o.files||[]).map(x=>x.id));
  (s.files||[]).forEach(x=>{if(!keep.has(x.id)){fileCache.delete(x.id);FileDB.del(x.id).catch(()=>{})}});
  s.f=o.f;s.lines=o.lines;s.att=o.att;s.ai=o.ai;s.files=o.files;
  IMP.undo=null;IMP.plan=null;
  commitImport();renderImpResult();
  $('#iMsg').textContent='Đã hoàn tác: form về trạng thái trước khi import.';
}

async function runImport(){
  if(IMP.busy)return;
  const msg=$('#iMsg'),btn=$('#iRun');
  if(IMP.files.some(x=>x.kind==='reading')){msg.textContent='Đang đọc file, vui lòng đợi giây lát.';return}
  const ready=IMP.files.filter(x=>x.kind!=='error');
  if(!ready.length){msg.textContent='Chưa có file nào đọc được.';return}
  const parts=[],attach=[],trunc=[];
  let total=0,attBytes=0;
  for(const x of ready){
    if(x.kind==='text'){
      let t=x.text;
      if(t.length>IMP_MAX_TEXT_FILE){t=t.slice(0,IMP_MAX_TEXT_FILE);trunc.push(x.name)}
      if(total+t.length>IMP_MAX_TEXT_TOTAL){t=t.slice(0,Math.max(0,IMP_MAX_TEXT_TOTAL-total));trunc.push(x.name)}
      total+=t.length;
      if(t)parts.push('### FILE: '+x.name+NL+t);
    }else if(x.kind==='attach'){
      attBytes+=x.size;
      if(attBytes>IMP_MAX_ATTACH){msg.textContent='Tổng dung lượng ảnh và PDF scan vượt '+fmtSize(IMP_MAX_ATTACH)+'. Hãy bỏ bớt file.';return}
      attach.push(x);
    }
  }
  const prov=$('#iProv').value;
  IMP.busy=true;btn.disabled=true;
  const old=btn.textContent;btn.textContent='Đang phân tích…';
  renderImpList();
  try{
    syncStoreFromForm();
    IMP.undo=snapshotState();
    const atts=[];
    for(const x of attach)atts.push({name:x.name,mime:x.mime,data:await toBase64(x.file)});
    const head=(await loadPrompt('import')).split('{{LOAI}}').join(mode==='IDA'?'nhập khẩu (IDA)':'xuất khẩu (EDA)');
    const prompt=buildExtractPrompt(head,parts,attach.map(x=>x.name));
    msg.textContent='Đang gửi '+ready.length+' file qua worker tới '+(($('#iProv').selectedOptions[0]||{}).textContent||'AI')+'…';
    const raw=await callAI(prompt,prov,{attachments:atts,json:true,maxTokens:12000,timeoutMs:240000});
    const data=extractJSON(raw);
    const hintMap={};
    ready.forEach(x=>{if(x.hints&&x.hints.length)hintMap[x.name]=x.hints[0]});
    if($('#iAttach').checked)addFiles(ready.map(x=>x.file),hintMap);
    const P=buildPlan(data);
    // bổ sung loại chứng từ nhận diện từ tên sheet và nội dung (mỗi loại một phần tử, kể cả khi cùng một file)
    ready.forEach(x=>(x.hints||[]).forEach(i=>{if(!P.docs.some(d=>d.file===x.name&&d.idx===i))P.docs.push({file:x.name,idx:i})}));
    applyFields(P.auto);
    if(P.lineAuto.length)applyLines(P.lineAuto,true);
    applyDocs(P.docs);
    IMP.plan=P;
    commitImport();
    renderImpResult();
    msg.textContent='Phân tích xong.'+(trunc.length?' Lưu ý: đã cắt bớt nội dung quá dài của '+trunc.join(', ')+'.':'')+aiNote;
  }catch(e){
    IMP.undo=null;
    const net=e instanceof TypeError;
    msg.textContent='Lỗi: '+(e&&e.message?e.message:e)+(net?'. Không kết nối được tới worker. Kiểm tra AI_CONFIG.workerUrl, mạng và ALLOWED_ORIGINS của worker.':'');
  }finally{IMP.busy=false;btn.disabled=false;btn.textContent=old;renderImpList()}
}

const dlg3=$('#dlg3');
function fillImpProv(){
  const sel=$('#iProv');if(sel.options.length)return;
  const P=AI_CONFIG.providers,ks=Object.keys(P).filter(k=>k!=='sample');
  ks.forEach(k=>sel.append(h('option',{value:k},P[k].label||k)));
  sel.value=ks.indexOf(AI_CONFIG.provider)>-1?AI_CONFIG.provider:ks[0];
}
$('#bImport').onclick=()=>{fillImpProv();renderImpList();$('#iMsg').textContent='';dlg3.showModal()};
$('#iClose').onclick=()=>dlg3.close();
$('#iClear').onclick=()=>{if(IMP.busy)return;IMP.files=[];renderImpList();$('#iMsg').textContent=''};
$('#iRun').onclick=runImport;
$('#iFileIn').addEventListener('change',e=>{addImportFiles(e.target.files);e.target.value=''});
['dragenter','dragover'].forEach(ev=>$('#iDrop').addEventListener(ev,e=>{e.preventDefault();$('#iDrop').classList.add('over')}));
['dragleave','drop'].forEach(ev=>$('#iDrop').addEventListener(ev,e=>{e.preventDefault();$('#iDrop').classList.remove('over')}));
$('#iDrop').addEventListener('drop',e=>{if(e.dataTransfer&&e.dataTransfer.files)addImportFiles(e.dataTransfer.files)});

/* ---------- xuất bản nháp PDF ---------- */
LIBS.jspdf={url:'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',get:()=>window.jspdf&&window.jspdf.jsPDF};
LIBS.autotable={url:'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.8.2/dist/jspdf.plugin.autotable.min.js',get:()=>{const J=window.jspdf&&window.jspdf.jsPDF;return J&&J.API&&J.API.autoTable?J.API.autoTable:null}};
function loadFonts(){
  if(window.HQ_FONTS)return Promise.resolve(window.HQ_FONTS);
  return new Promise((res,rej)=>{
    const sc=document.createElement('script');
    sc.src='fonts.js';
    sc.onload=()=>window.HQ_FONTS?res(window.HQ_FONTS):rej(new Error('fonts.js đã tải nhưng không có dữ liệu font'));
    sc.onerror=()=>rej(new Error('Không tải được fonts.js (hãy để chung thư mục với index.html)'));
    document.head.append(sc);
  });
}

async function buildPdf(){
  const J=await loadLib('jspdf');
  await loadLib('autotable');
  const FN=await loadFonts();
  syncStoreFromForm();
  const s=st(),imp=mode==='IDA',f=s.f,c=calc(),ai=s.ai||{};
  const doc=new J({orientation:'landscape',unit:'pt',format:'a4',compress:true});
  doc.addFileToVFS('BVP-Regular.ttf',FN.regular);doc.addFont('BVP-Regular.ttf','BVP','normal');
  doc.addFileToVFS('BVP-Bold.ttf',FN.bold);doc.addFont('BVP-Bold.ttf','BVP','bold');
  const W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=36;
  const INK=[31,31,29],MUT=[95,94,90],LINE=[201,210,221],BRAND=[11,60,122],LABEL=[246,248,250];
  const EMPTY='(trống)';
  const title=imp?'TỜ KHAI HẢI QUAN NHẬP KHẨU (IDA) – BẢN NHÁP':'TỜ KHAI HẢI QUAN XUẤT KHẨU (EDA) – BẢN NHÁP';
  doc.setProperties({title:title,subject:'Bản nháp tờ khai hải quan, chưa gửi lên VNACCS/VCIS',creator:'Soát nháp tờ khai hải quan'});
  doc.setFont('BVP','bold');doc.setFontSize(16);doc.setTextColor(INK[0],INK[1],INK[2]);
  doc.text(title,M,M+8);
  doc.setFont('BVP','normal');doc.setFontSize(9);doc.setTextColor(MUT[0],MUT[1],MUT[2]);
  doc.text('Lập lúc '+new Date().toLocaleString('vi-VN')+'. Chưa gửi lên hệ thống VNACCS/VCIS. Chỉ dùng để rà soát, hãy đối chiếu với chứng từ gốc.',M,M+24);
  let y=M+42;
  const base={
    styles:{font:'BVP',fontSize:8.5,cellPadding:{top:3,bottom:3,left:5,right:5},textColor:INK,lineColor:LINE,lineWidth:0.4,overflow:'linebreak',valign:'top'},
    headStyles:{font:'BVP',fontStyle:'bold',fillColor:[238,237,254],textColor:[60,52,137],lineColor:LINE,lineWidth:0.4},
    margin:{left:M,right:M,top:M+10,bottom:M+22},
    didParseCell:d=>{if(d.section==='body'&&d.cell.text.join('')===EMPTY)d.cell.styles.textColor=[150,150,145]}
  };
  const heading=t=>{
    if(y>H-110){doc.addPage();y=M+10}
    doc.setFont('BVP','bold');doc.setFontSize(11);doc.setTextColor(BRAND[0],BRAND[1],BRAND[2]);
    doc.text(t,M,y);y+=6;
  };
  const table=o=>{doc.autoTable(Object.assign({},base,o,{startY:y}));y=doc.lastAutoTable.finalY+16};
  const fieldValue=fd=>{
    let v=fd.computed?(c.tot?fmtN(c.tot,2)+' '+(f.mt||''):''):String(f[fd.k]==null?'':f[fd.k]).trim();
    if(v&&!fd.computed)v=optLabel(fd,v);
    if(!v)return EMPTY;
    return ai['f-'+fd.k]?v+'  [AI]':v;
  };
  const kvRows=fields=>{
    const rows=[];let pend=null;
    fields.forEach(fd=>{
      const it={l:fd.l,v:fieldValue(fd)};
      const full=fd.w>=9||it.v.length>60||fd.type==='area';
      if(full){
        if(pend){rows.push([pend.l,pend.v,'','']);pend=null}
        rows.push([it.l,{content:it.v,colSpan:3}]);
      }else if(pend){rows.push([pend.l,pend.v,it.l,it.v]);pend=null}
      else pend=it;
    });
    if(pend)rows.push([pend.l,pend.v,'','']);
    return rows;
  };
  const kvStyles={0:{cellWidth:125,fontStyle:'bold',textColor:MUT,fillColor:LABEL},1:{cellWidth:260},2:{cellWidth:125,fontStyle:'bold',textColor:MUT,fillColor:LABEL},3:{cellWidth:'auto'}};
  const num2=v=>v===''||v==null?'':String(v);

  SEC.forEach(sec=>{
    if(sec.type==='review')return;
    if(sec.type==='lines'){
      heading('Danh sách hàng ('+s.lines.length+' dòng)');
      const head=imp?['STT','Mã HS','Mô tả hàng hóa','Xuất xứ','Số lượng','ĐVT','Đơn giá','Trị giá HĐ','Thuế NK %','GTGT %','Thuế NK (VND)','GTGT (VND)']
                    :['STT','Mã HS','Mô tả hàng hóa','Số lượng','ĐVT','Đơn giá','Trị giá HĐ','Thuế XK %','Thuế XK (VND)'];
      let anyAI=false;
      const body=s.lines.map((l,i)=>{
        const mark=Object.keys(ai).some(k=>k.indexOf('l-'+i+'-')===0);
        if(mark)anyAI=true;
        const r=imp?[l.hs,l.mota,l.xx,l.sl,l.dv,l.dg,l.tt?fmtN(l.tt,2):'',l.ts,l.vat,l.base?fmtN(l.t1):'',l.base?fmtN(l.t2):'']
                   :[l.hs,l.mota,l.sl,l.dv,l.dg,l.tt?fmtN(l.tt,2):'',l.ts,l.base?fmtN(l.t1):''];
        return [(i+1)+(mark?' *':'')].concat(r.map(num2));
      });
      const right=imp?[4,6,7,8,9,10,11]:[3,5,6,7,8];
      const W1=imp?[28,58,'auto',38,46,34,44,62,46,42,70,66]:[28,58,'auto',46,34,44,62,46,70];
      const cs={};
      W1.forEach((w,i)=>{cs[i]={cellWidth:w}});
      right.forEach(i=>{cs[i].halign='right'});
      table({head:[head],body:body,columnStyles:cs,theme:'grid'});
      if(anyAI){y-=2;doc.setFont('BVP','normal');doc.setFontSize(8);doc.setTextColor(MUT[0],MUT[1],MUT[2]);doc.text('* Dòng có dữ liệu do AI điền từ chứng từ, cần đối chiếu với chứng từ gốc.',M,y);y+=22}
      heading('Tổng hợp tạm tính');
      const nr=!c.ty&&c.tot>0,mny=v=>nr?'Chưa tính':fmtN(v);
      const sum=[['Tổng trị giá hóa đơn',fmtN(c.tot,2)+' '+(f.mt||'')]];
      if(nr)sum.push(['Lưu ý','Chưa nhập tỷ giá tính thuế nên chưa tính được trị giá tính thuế và thuế']);
      if(imp)sum.push(['Phí vận tải, bảo hiểm và điều chỉnh (ngoại tệ)',fmtN(c.fees,2)]);
      sum.push(['Tổng trị giá tính thuế (VND)',mny(c.base)]);
      sum.push([imp?'Thuế nhập khẩu (VND)':'Thuế xuất khẩu (VND)',mny(c.s1)]);
      if(imp)sum.push(['Thuế GTGT (VND)',mny(c.s2)]);
      sum.push(['Tổng thuế tạm tính (VND)',mny(c.s1+c.s2)]);
      table({body:sum,columnStyles:{0:{cellWidth:300,fontStyle:'bold',fillColor:LABEL,textColor:MUT},1:{cellWidth:200,halign:'right'}},theme:'grid',margin:{left:M,right:W-M-500,top:M+10,bottom:M+22}});
      y-=2;doc.setFont('BVP','normal');doc.setFontSize(8);doc.setTextColor(MUT[0],MUT[1],MUT[2]);
      doc.text('Số thuế chỉ là ước tính để đối chiếu, chưa gồm thuế tiêu thụ đặc biệt, bảo vệ môi trường, chống bán phá giá... Số chính thức do hệ thống hải quan tính.',M,y);y+=24;
      return;
    }
    heading(sec.title);
    table({body:kvRows(sec.fields),columnStyles:kvStyles,theme:'grid'});
    if(sec.id==='ct'){
      heading('Chứng từ đính kèm');
      const files=s.files||[];
      const rows=ATT.map((a,i)=>{
        const names=files.filter(x=>String(x.type)===String(i)).map(x=>x.name).join(', ');
        return [a,s.att[i]?'Đã chọn':'Chưa chọn',names||'(chưa có tệp)'];
      });
      const un=files.filter(x=>x.type===''||x.type==null).map(x=>x.name).join(', ');
      if(un)rows.push(['Chưa phân loại','',un]);
      table({head:[['Loại chứng từ','Trạng thái','Tệp đã tải lên']],body:rows,columnStyles:{0:{cellWidth:280},1:{cellWidth:80},2:{cellWidth:'auto'}},theme:'grid'});
    }
  });

  // kết quả soát lỗi nội bộ
  const issues=validate().slice().sort((a,b)=>(a.sev===b.sev?0:a.sev==='err'?-1:1));
  heading('Kết quả soát lỗi nội bộ');
  if(!issues.length){
    doc.setFont('BVP','normal');doc.setFontSize(9);doc.setTextColor(INK[0],INK[1],INK[2]);
    doc.text('Không phát hiện lỗi hoặc cảnh báo.',M,y+6);y+=24;
  }else{
    table({head:[['Mức','Phần','Nội dung']],body:issues.map(i=>{const sc=SEC.find(x=>x.id===i.sec);return [i.sev==='err'?'LỖI':'LƯU Ý',sc?sc.title:'',i.msg]}),
      columnStyles:{0:{cellWidth:50},1:{cellWidth:170},2:{cellWidth:'auto'}},theme:'grid',
      didParseCell:d=>{if(d.section==='body'&&d.column.index===0)d.cell.styles.textColor=d.cell.text.join('')==='LỖI'?[179,38,30]:[138,83,0]}});
  }

  // đóng dấu mờ và chân trang trên mọi trang
  const n=doc.getNumberOfPages();
  const wm='BẢN NHÁP',ang=30,rad=ang*Math.PI/180;
  for(let i=1;i<=n;i++){
    doc.setPage(i);
    doc.setFont('BVP','bold');doc.setFontSize(96);
    const tw=doc.getTextWidth(wm);
    doc.setGState(new doc.GState({opacity:0.07}));
    doc.setTextColor(179,38,30);
    doc.text(wm,W/2-(tw/2)*Math.cos(rad),H/2+(tw/2)*Math.sin(rad)+20,{angle:ang});
    doc.setGState(new doc.GState({opacity:1}));
    doc.setFont('BVP','normal');doc.setFontSize(8);doc.setTextColor(MUT[0],MUT[1],MUT[2]);
    doc.text('Bản nháp soát tờ khai '+(imp?'nhập khẩu (IDA)':'xuất khẩu (EDA)')+', chưa gửi lên VNACCS/VCIS',M,H-20);
    doc.text('Trang '+i+'/'+n,W-M,H-20,{align:'right'});
  }
  const id=String((imp?f.nk_ma:f.xk_ma)||'').replace(/[^0-9A-Za-z-]/g,'')||'chua-co-mst';
  const name='ban-nhap-to-khai-'+(imp?'nhap-khau':'xuat-khau')+'-'+id+'-'+new Date().toISOString().slice(0,10)+'.pdf';
  return {doc:doc,name:name};
}

async function savePdfBlob(blob,name){
  try{
    const dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;
    if(dl){await dl.save({filename:name,data:blob});return 'claude'}
  }catch(e){if(e&&e.code==='declined')return 'declined'}
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);a.download=name;
  document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),4000);
  return 'browser';
}
let pdfBusy=false;
async function exportPdf(){
  if(pdfBusy)return;
  const btn=$('#bPdf'),old=btn.textContent;
  pdfBusy=true;btn.disabled=true;btn.textContent='Đang tạo PDF…';
  try{
    const r=await buildPdf();
    const how=await savePdfBlob(r.doc.output('blob'),r.name);
    toast(how==='declined'?'Bạn đã hủy lưu file PDF':'Đã tạo '+r.name,3500);
  }catch(e){
    toast('Không xuất được PDF: '+(e&&e.message?e.message:e),6000);
  }finally{pdfBusy=false;btn.disabled=false;btn.textContent=old}
}
$('#bPdf').onclick=exportPdf;

/* ---------- dữ liệu mẫu ---------- */
function sample(){
  const today=new Date().toISOString().slice(0,10);
  const d=(n)=>{const x=new Date();x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)};
  (st().files||[]).forEach(x=>{fileCache.delete(x.id);FileDB.del(x.id).catch(()=>{})});
  if(mode==='IDA'){
    store.IDA={f:{loai_hinh:'A11',pt_vc:'2',ngay_dk:today,nk_ma:'0312345678',nk_ten:'CONG TY TNHH THUONG MAI ABC',nk_bc:'700000',nk_dc:'12 NGUYEN HUE, PHUONG BEN NGHE, TP HO CHI MINH',nk_sdt:'0281234567',xk_ten:'SHANGHAI DEMO TRADING CO., LTD',xk_nuoc:'CN',xk_dc:'NO. 88 DEMO ROAD, PUDONG, SHANGHAI',vd_so:'COSU6123456789',so_kien:'120',dv_kien:'CT',tl_gross:'2450.5',dv_tl:'KGM',so_cont:'TGHU1234567',kho_ma:'03TG001',xep_ma:'CNSHA',do_ma:'VNSGN',pt_ten:'DEMO VESSEL / 012E',ngay_den:d(3),hd_loai:'A',hd_so:'INV-2026-0456',hd_ngay:d(-10),tt_pt:'TTR',dk_gia:'FOB',mt:'USD',ty_gia:'25450',hdong_so:'HD-ABC-01',hdong_ngay:d(-90),vc_phi:'320',bh_phi:'15',ghi_chu:'Hàng mới 100%'},
      lines:[{hs:'39231090',mota:'HOP NHUA PP DUNG DE DO DUNG, MOI 100%',xx:'CN',sl:'5000',dv:'PCE',dg:'1.2',ts:'10',vat:'10'},{hs:'39241090',mota:'DUNG CU NHA BEP BANG NHUA',xx:'CN',sl:'2000',dv:'PCE',dg:'2.35',ts:'20',vat:'10'}],chk:{},att:{0:true,1:true,2:true},files:[]};
  }else{
    store.EDA={f:{loai_hinh:'B11',pt_vc:'2',ngay_xk:d(2),xk_ma:'0312345678',xk_ten:'CONG TY TNHH THUONG MAI ABC',xk_dc:'12 NGUYEN HUE, PHUONG BEN NGHE, TP HO CHI MINH',nk_ten:'DEMO IMPORT LLC',nk_nuoc:'US',nk_dc:'100 DEMO AVE, LOS ANGELES, CA',vd_so:'',so_kien:'300',dv_kien:'CT',tl_gross:'4200',dv_tl:'KGM',so_cont:'MSKU7654321',kho_ma:'03CC001',xep_ma:'VNSGN',do_ma:'USLAX',hd_loai:'A',hd_so:'EXP-2026-018',hd_ngay:today,tt_pt:'TTR',dk_gia:'FOB',mt:'USD',ty_gia:'25450'},
      lines:[{hs:'09011110',mota:'CA PHE NHAN ROBUSTA CHUA RANG',sl:'19200',dv:'KGM',dg:'3.1',ts:'0'}],chk:{},att:{0:true,1:true},files:[]};
  }
  showAll=false;render();save();toast('Đã nạp dữ liệu mẫu (minh họa)');
}

/* ---------- sự kiện toàn cục ---------- */
function setMode(m){
  mode=m;SEC=build(m);showAll=false;
  $('#m-IDA').setAttribute('aria-pressed',m==='IDA');$('#m-EDA').setAttribute('aria-pressed',m==='EDA');
  render();save();window.scrollTo(0,0);
}
$('#m-IDA').onclick=()=>setMode('IDA');
$('#m-EDA').onclick=()=>setMode('EDA');
$('#bCheck').onclick=()=>{showAll=true;refresh();go('sec-review')};
$('#bSample').onclick=sample;
function wipeAllData(){
  clearTimeout(saveT);
  // 1) bộ nhớ trong trang: bản nháp IDA và EDA, file chứng từ, kết quả AI, danh sách import
  store={IDA:blank(),EDA:blank()};
  showAll=false;
  fileCache.clear();
  memPairs=[];memMeta={fields:{}};
  aiCSV='';aiNote='';
  IMP.files=[];IMP.undo=null;IMP.plan=null;
  // 2) bộ nhớ của trình duyệt (kể cả dữ liệu cũ từ các phiên bản trước)
  [KEY,PAIRS_KEY,META_KEY].forEach(k=>Store.del(k));
  purgeLegacyStorage();
  // 3) các hộp thoại và ô nhập
  ['#pBox','#pOut','#iFileIn'].forEach(sel=>{const e=$(sel);if(e)e.value=''});
  ['#iList','#iResult'].forEach(sel=>{const e=$(sel);if(e)e.innerHTML=''});
  ['#pMsg','#iMsg'].forEach(sel=>{const e=$(sel);if(e)e.textContent=''});
  const dl=$('#pDl');if(dl)dl.hidden=true;
  const po=$('#pOut');if(po)po.hidden=true;
  // 4) dựng lại form trống
  render();
  try{window.scrollTo(0,0)}catch(e){}
}
let resetArm=0;
$('#bReset').onclick=e=>{
  if(!resetArm){resetArm=1;e.target.textContent='Bấm lần nữa để xóa tất cả';setTimeout(()=>{resetArm=0;e.target.textContent='Xóa toàn bộ dữ liệu'},3000);return}
  resetArm=0;e.target.textContent='Xóa toàn bộ dữ liệu';
  wipeAllData();
  toast('Đã xóa toàn bộ dữ liệu: form, bản nháp, chứng từ và dữ liệu lưu trong trình duyệt',3500);
};
/* ---------- hộp thoại dữ liệu review ---------- */
const dlg2=$('#dlg2');
function showPairs(){
  syncPairs();
  const m=$('#pMode').value,arr=getPairs(m);
  $('#pBox').value='['+NL+arr.map(p=>'  '+JSON.stringify(p)).join(','+NL)+NL+']';
  $('#pInfo').textContent='Đã lưu '+getPairs().length+' cặp [key, value] của cả IDA và EDA vào '+(HQ_PERSIST==='session'?'sessionStorage (tự xóa khi đóng tab hoặc trình duyệt)':'bộ nhớ của trang (không ghi xuống đĩa)')+', khóa “'+PAIRS_KEY+'”. Nhãn, phần và bảng mã của từng key nằm ở khóa “'+META_KEY+'”. Đang hiển thị '+arr.length+' cặp.';
  $('#pMsg').textContent='';
}
$('#bPairs').onclick=()=>{$('#pMode').value=mode;showPairs();resetAI();dlg2.showModal()};
$('#pMode').onchange=()=>{showPairs();resetAI()};
$('#pClose').onclick=()=>dlg2.close();
/* ---------- AI review ---------- */
let aiCSV='',aiBusy=false,aiNote='';
function resetAI(){aiCSV='';aiNote='';$('#pDl').hidden=true;$('#pOut').hidden=true;$('#pOut').value='';$('#pMsg').textContent=''}

// Đọc phản hồi gốc mà worker chuyển tiếp từ từng nhà cung cấp
function parseAIResponse(prov,j){
  if(prov==='anthropic'){
    if(j.stop_reason==='max_tokens')aiNote=' Kết quả có thể bị cắt do hết max_tokens.';
    return (j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  }
  if(prov==='openai'){
    const ch=(j.choices&&j.choices[0])||{};
    if(ch.finish_reason==='length')aiNote=' Kết quả có thể bị cắt do hết max tokens.';
    return (ch.message&&ch.message.content)||'';
  }
  if(prov==='gemini'){
    const cand=(j.candidates&&j.candidates[0])||{};
    if(cand.finishReason==='MAX_TOKENS')aiNote=' Kết quả có thể bị cắt do hết maxOutputTokens.';
    const out=((cand.content&&cand.content.parts)||[]).map(x=>x.text||'').join('');
    if(!out){
      const why=(j.promptFeedback&&j.promptFeedback.blockReason)||cand.finishReason||'rỗng';
      throw new Error('Gemini không trả nội dung ('+why+')'+(why==='MAX_TOKENS'?'. Có thể Gemini đã dùng hết token để suy nghĩ: tăng AI_CONFIG.maxTokens (tối đa 16000) hoặc giảm mức suy nghĩ trên worker (Gemini 3.x: GEMINI_THINKING_LEVEL=low; Gemini 2.5: GEMINI_THINKING_BUDGET)':''));
    }
    return out;
  }
  throw new Error('Nhà cung cấp không được hỗ trợ: '+prov);
}

async function callAI(text,prov,opts){
  opts=opts||{};
  const c=AI_CONFIG,p=(c.providers&&c.providers[prov])||{};
  aiNote='';
  if(prov==='sample'){
    const sm=window.claude&&window.claude.use?await window.claude.use('sample'):null;
    if(!sm)throw new Error('Chế độ sample chỉ chạy khi trang được mở trong claude.ai');
    const r=await sm(text,{modelTier:'default',cache:false});
    if(r.truncated)aiNote=' Kết quả có thể bị cắt ngắn.';
    return r.text;
  }
  if(!c.workerUrl)throw new Error('Chưa điền AI_CONFIG.workerUrl');
  const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),opts.timeoutMs||c.timeoutMs||120000);
  let r,raw;
  try{
    r=await fetch(c.workerUrl,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:text,prov:prov,model:p.model||'',maxTokens:opts.maxTokens||c.maxTokens,attachments:opts.attachments&&opts.attachments.length?opts.attachments:undefined,json:opts.json?true:undefined}),signal:ctrl.signal});
    raw=await r.text();
  }catch(e){
    if(e&&e.name==='AbortError')throw new Error('Hết thời gian chờ worker ('+Math.round((opts.timeoutMs||c.timeoutMs||120000)/1000)+' giây)');
    throw e;
  }finally{clearTimeout(timer)}
  let j=null;
  try{j=JSON.parse(raw)}catch(e){}
  const em=j&&j.error?(typeof j.error==='string'?j.error:(j.error.message||JSON.stringify(j.error))):'';
  if(!r.ok||(em&&!j.content&&!j.choices&&!j.candidates))throw new Error(em||('Worker trả về '+r.status+': '+String(raw).slice(0,200)));
  if(!j)throw new Error('Worker trả về dữ liệu không phải JSON: '+String(raw).slice(0,200));
  return parseAIResponse(prov,j);
}

// ---- Chuẩn hóa phản hồi review của AI thành CSV ----
// Chịu được các cách trình bày hay gặp: lời dẫn/kết luận quanh bảng, khối mã ```, bảng markdown,
// dấu chấm phẩy hoặc tab làm dấu phân cách, thiếu dòng tiêu đề, JSON, và phản hồi bị cắt giữa chừng.
const REVIEW_HEAD=['key','danh_gia','ly_do','de_xuat','ma_hs_de_xuat','do_tin_cay','can_cu_phan_loai'];
const KEY_RE=/^(IDA|EDA)\.[A-Za-z0-9_.]+$/;
function cleanCell(x){return String(x==null?'':x).split('`').join('').split('*').join('').trim()}
function parseDelim(t,delim){
  const rows=[],CR=String.fromCharCode(13);
  let row=[],cur='',q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){
      if(ch===QT){if(t[i+1]===QT){cur+=QT;i++}else q=false}
      else cur+=ch;
    }else if(ch===QT&&cur.trim()==='')q=true;
    else if(ch===delim){row.push(cur);cur=''}
    else if(ch===NL){row.push(cur);rows.push(row);row=[];cur=''}
    else if(ch!==CR)cur+=ch;
  }
  const open=q;
  if(cur!==''||row.length){row.push(cur);rows.push(row)}
  return {rows:rows.filter(r=>r.some(x=>String(x).trim()!=='')),open:open};
}
// Lấy các đối tượng JSON hoàn chỉnh trong mảng đầu tiên, bỏ qua phần bị cắt dở
function salvageObjects(s){
  const out=[];
  let depth=0,inStr=false,esc=false,start=-1,seenArr=false,base=0;
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(inStr){if(esc)esc=false;else if(ch==='\\')esc=true;else if(ch===QT)inStr=false;continue}
    if(ch===QT){inStr=true;continue}
    if(ch==='['&&!seenArr){seenArr=true;base=depth;continue}
    if(ch==='{'){if(seenArr&&depth===base)start=i;depth++}
    else if(ch==='}'){
      depth--;
      if(seenArr&&depth===base&&start>-1){try{out.push(JSON.parse(s.slice(start,i+1)))}catch(e){}start=-1}
    }
  }
  return out;
}
function csvLikeTable(t){
  const lines=t.split(NL).filter(l=>l.trim().slice(0,3)!=='```');
  const pick=l=>{let best=',',n=-1;[',','\t',';','|'].forEach(d=>{const c=l.split(d).length-1;if(c>n){n=c;best=d}});return {d:best,n:n}};
  let idx=-1,headerless=false;
  for(let i=0;i<lines.length;i++){
    const low=lines[i].toLowerCase();
    if(/(^|[^a-z_])key([^a-z_]|$)/.test(low)&&(low.indexOf('value')>-1||low.indexOf('danh_gia')>-1||low.indexOf('đánh giá')>-1)&&pick(lines[i]).n>=2){idx=i;break}
  }
  if(idx<0){
    for(let i=0;i<lines.length;i++){
      const first=lines[i].replace(/^[\s|"'`*]+/,'');
      if(/^(IDA|EDA)\./.test(first)&&pick(lines[i]).n>=2){idx=i;headerless=true;break}
    }
  }
  if(idx<0)return null;
  const d=pick(lines[idx]).d;
  const body=(headerless?REVIEW_HEAD.join(d)+NL:'')+lines.slice(idx).join(NL);
  const p=parseDelim(body,d);
  let rows=p.rows;
  if(d==='|'){
    rows=rows.map(r=>{r=r.slice();if(r.length&&r[0].trim()==='')r.shift();if(r.length&&r[r.length-1].trim()==='')r.pop();return r})
             .filter(r=>!(r.length&&r.every(c=>/^:?-{2,}:?$/.test(c.trim()))));
  }
  if(rows.length<1)return null;
  const fmt=headerless?'CSV không có dòng tiêu đề':d==='|'?'bảng markdown':d===';'?'CSV dùng dấu chấm phẩy':d==='\t'?'CSV dùng tab':'';
  return {head:rows[0].map(cleanCell),data:rows.slice(1),cut:p.open,fmt:fmt};
}
function normalizeReviewOutput(raw){
  const t=String(raw||'').split(String.fromCharCode(13)).join('').split(String.fromCharCode(0xFEFF)).join('').trim();
  const fail=why=>({ok:false,text:'',rows:0,dropped:0,cut:false,fmt:'',why:why});
  if(!t)return fail('AI trả về nội dung rỗng');
  let head,data,cut=false,fmt='';
  if(/"(key|khoa)"\s*:/i.test(t)){
    const objs=salvageObjects(t);
    if(!objs.length)return fail('phản hồi là JSON nhưng không có dòng đánh giá nào đọc được');
    const names=[];
    objs.forEach(o=>Object.keys(o).forEach(k=>{const n=k.toLowerCase()==='khoa'?'key':k;if(names.indexOf(n)<0)names.push(n)}));
    head=REVIEW_HEAD.filter(h=>names.indexOf(h)>-1).concat(names.filter(n=>REVIEW_HEAD.indexOf(n)<0));
    data=objs.map(o=>head.map(h=>{const v=o[h]!==undefined?o[h]:(h==='key'?o.khoa:undefined);return v==null?'':(typeof v==='object'?JSON.stringify(v):String(v))}));
    try{JSON.parse(t.slice(Math.min.apply(null,[t.indexOf('['),t.indexOf('{')].filter(x=>x>-1)),Math.max(t.lastIndexOf(']'),t.lastIndexOf('}'))+1))}catch(e){cut=true}
    fmt='JSON';
  }else{
    const tb=csvLikeTable(t);
    if(!tb)return fail('không tìm thấy dòng tiêu đề (cần có cột key, value...) hoặc dòng dữ liệu bắt đầu bằng IDA. / EDA.');
    head=tb.head;data=tb.data;cut=tb.cut;fmt=tb.fmt;
  }
  let ki=head.findIndex(h=>{const l=h.toLowerCase();return l==='key'||l==='khoa'||l==='khóa'});
  if(ki<0){
    let best=-1,score=0;
    head.forEach((h,i)=>{const n=data.filter(r=>KEY_RE.test(cleanCell(r[i]))).length;if(n>score){score=n;best=i}});
    ki=best;
  }
  if(ki<0)return fail('không có cột chứa key dạng IDA.f.xxx / EDA.f.xxx');
  head=head.slice();head[ki]='key';
  if(cut&&data.length)data=data.slice(0,-1);
  const good=[];let dropped=0;
  data.forEach(r0=>{
    let r=r0.slice();
    while(r.length<head.length)r.push('');
    if(r.length>head.length){const ov=r.slice(head.length-1).filter(x=>String(x).trim()!=='');r=r.slice(0,head.length-1).concat([ov.join(', ')])}
    const k=cleanCell(r[ki]);
    if(!KEY_RE.test(k)){dropped++;return}
    r[ki]=k;good.push(r);
  });
  if(!good.length&&data.length)return fail('đọc được bảng nhưng không có dòng nào có key hợp lệ');
  const text=[head.map(h=>csvCell(h)).join(',')].concat(good.map(r=>r.map(x=>csvCell(x)).join(','))).join(NL);
  return {ok:true,text:text,rows:good.length,dropped:dropped,cut:cut,fmt:fmt,why:''};
}

// Đọc CSV (hỗ trợ ô có dấu ngoặc kép, dấu phẩy và xuống dòng trong ô)
function parseCSV(t){
  const rows=[],CR=String.fromCharCode(13);
  let row=[],cur='',q=false;
  for(let i=0;i<t.length;i++){
    const ch=t[i];
    if(q){
      if(ch===QT){if(t[i+1]===QT){cur+=QT;i++}else q=false}
      else cur+=ch;
    }else if(ch===QT)q=true;
    else if(ch===',')row.push(cur),cur='';
    else if(ch===NL)row.push(cur),rows.push(row),row=[],cur='';
    else if(ch!==CR)cur+=ch;
  }
  if(cur!==''||row.length){row.push(cur);rows.push(row)}
  return rows.filter(r=>r.some(x=>String(x).trim()!==''));
}

// Gắn cột key với tiêu đề hiển thị trên form để người dùng dễ nhận biết mục cần chú ý
function mapCSVToTitles(csv,pairs){
  const rows=parseCSV(csv);
  if(rows.length<2)return null;
  const head=rows[0].map(x=>String(x).trim());
  const ki=head.findIndex(x=>x.toLowerCase()==='key');
  if(ki<0)return null;
  const vi=head.findIndex(x=>x.toLowerCase()==='value');
  const meta=(getMeta().fields)||{};
  const has=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);
  const pv={};pairs.forEach(x=>{pv[x[0]]=x[1]});
  const names={danh_gia:'Đánh giá',ly_do:'Lý do',de_xuat:'Đề xuất',ma_hs_de_xuat:'Mã HS đề xuất',do_tin_cay:'Độ tin cậy',can_cu_phan_loai:'Căn cứ phân loại'};
  const rest=head.map((x,i)=>i).filter(i=>i!==ki&&i!==vi);
  const out=[['Tờ khai','Phần','Tiêu đề trường','Giá trị'].concat(rest.map(i=>names[head[i].toLowerCase()]||head[i]),['Key'])];
  rows.slice(1).forEach(r=>{
    const key=String(r[ki]||'').trim();
    const m=has(meta,key)?meta[key]:null;
    const loai=key.indexOf('IDA.')===0?'Nhập khẩu (IDA)':key.indexOf('EDA.')===0?'Xuất khẩu (EDA)':'';
    const val=has(pv,key)?pv[key]:(vi>-1?String(r[vi]||''):'');
    out.push([loai,m?m.section:'',m?m.label:'(không có trong form)',val].concat(rest.map(i=>String(r[i]||'')),[key]));
  });
  return out.map(r=>r.map(csvCell).join(',')).join(NL);
}

// Đọc đúng dữ liệu đang hiển thị trong form review: mảng [[key, value], ...]
function readPairsFromForm(){
  try{
    const arr=JSON.parse($('#pBox').value);
    if(!Array.isArray(arr))return null;
    const ok=arr.every(p=>Array.isArray(p)&&p.length===2&&typeof p[0]==='string');
    return ok?arr.map(p=>[p[0],String(p[1]==null?'':p[1])]):null;
  }catch(e){return null}
}

// Đọc prompt từ file văn bản (mỗi lần bấm đọc lại nên sửa file là có hiệu lực ngay, không cần tải lại trang).
// Nếu trang đã nhúng sẵn window.HQ_PROMPTS = { review: "...", import: "..." } thì dùng bản nhúng (dùng cho bản một file).
async function loadPrompt(name){
  if(window.HQ_PROMPTS&&typeof window.HQ_PROMPTS[name]==='string'&&window.HQ_PROMPTS[name].trim())return window.HQ_PROMPTS[name].trim();
  const url=AI_CONFIG.promptFiles&&AI_CONFIG.promptFiles[name];
  if(!url)throw new Error('Chưa khai báo AI_CONFIG.promptFiles.'+name);
  let r;
  try{r=await fetch(url,{cache:'no-store'})}
  catch(e){throw new Error('Không tải được file prompt '+url+' (hãy chạy qua http hoặc GitHub Pages, không mở trực tiếp bằng file://)')}
  if(!r.ok)throw new Error('Không tải được file prompt '+url+' (mã '+r.status+')');
  const t=String(await r.text()).trim();
  if(!t)throw new Error('File prompt '+url+' đang trống');
  return t;
}

// Bổ sung các dòng AI không nêu (mặc định coi là DUNG) để CSV đủ mọi ô, đúng thứ tự trên form
function completeReviewCSV(csv,pairs){
  const rows=parseCSV(csv);
  if(!rows.length)return {text:csv,added:0,total:0};
  const head=rows[0].map(x=>String(x).trim());
  const ki=head.indexOf('key');
  if(ki<0)return {text:csv,added:0,total:Math.max(rows.length-1,0)};
  const di=head.findIndex(h=>h.toLowerCase()==='danh_gia'),li=head.findIndex(h=>h.toLowerCase()==='ly_do');
  const have={};
  rows.slice(1).forEach(r=>{const k=String(r[ki]||'').trim();if(!Object.prototype.hasOwnProperty.call(have,k))have[k]=r});
  const out=[head],used={};
  let added=0;
  pairs.forEach(p=>{
    const r=have[p[0]];
    if(r){out.push(r);used[p[0]]=1;return}
    const nr=head.map(()=>'');
    nr[ki]=p[0];
    if(di>-1)nr[di]='DUNG';
    if(li>-1)nr[li]='(AI không nêu vấn đề)';
    out.push(nr);added++;
  });
  rows.slice(1).forEach(r=>{if(!used[String(r[ki]||'').trim()])out.push(r)});
  return {text:out.map(r=>r.map(x=>csvCell(x)).join(',')).join(NL),added:added,total:out.length-1};
}

async function runAIReview(){
  if(aiBusy)return;
  const c=AI_CONFIG,btn=$('#pAI'),msg=$('#pMsg');
  showPairs();
  resetAI();
  const all=readPairsFromForm();
  if(!all){msg.textContent='Dữ liệu trong form không phải mảng [key, value] hợp lệ.';return}
  if(!all.length){msg.textContent='Chưa có dữ liệu để review.';return}
  const meta=(getMeta().fields)||{};
  // Gửi gọn để AI xử lý nhanh: bỏ ô trống không bắt buộc và cờ chứng từ chưa chọn
  const pairs=c.skipEmpty===false?all:all.filter(p=>{
    const v=String(p[1]).trim(),m=meta[p[0]];
    return (m&&m.required)||(v!==''&&v!=='0');
  });
  if(!pairs.length){msg.textContent='Chưa có ô nào có dữ liệu để review.';return}
  const lines=pairs.map(p=>{
    const m=meta[p[0]]||{};
    let v=String(p[1]).split(NL).join(' ').trim();
    if(v.length>200)v=v.slice(0,200)+'…';
    return p[0]+' | '+(m.label||'')+(m.required?' *':'')+' | '+v;
  });
  const dataText=NL+NL+'DỮ LIỆU ('+pairs.length+' dòng, dạng key | nhãn | giá trị, dấu * sau nhãn là ô bắt buộc):'+NL+lines.join(NL)
    +NL+NL+'NHẮC LẠI: chỉ trả CSV thuần, dòng đầu là tiêu đề '+REVIEW_HEAD.join(',')+', rồi chỉ các ô có vấn đề và các dòng mã HS. Không lời dẫn, không markdown, không khối mã.';
  aiBusy=true;btn.disabled=true;
  const old=btn.textContent;btn.textContent='Đang review…';
  msg.textContent='Đang gửi '+pairs.length+' ô (từ '+all.length+' cặp [key, value] trong form) cho '+(($('#pProv').selectedOptions[0]||{}).textContent||'AI')+'…';
  try{
    const text=(await loadPrompt('review'))+dataText;
    const raw=await callAI(text,$('#pProv').value);
    const res=normalizeReviewOutput(raw);
    let added=0,total=res.rows;
    if(res.ok){
      const cp=completeReviewCSV(res.text,pairs);
      res.text=cp.text;added=cp.added;total=cp.total;
      const mp=mapCSVToTitles(res.text,pairs);
      if(mp){res.text=mp;res.mapped=true}
    }
    const out=$('#pOut');out.hidden=false;out.value=res.ok?res.text:String(raw||'');
    if(res.ok){
      aiCSV=res.text;$('#pDl').hidden=false;
      msg.textContent='Xong: AI nêu '+res.rows+' dòng'+(added?', trang ghi DUNG cho '+added+' ô AI không nêu vấn đề':'')+'. CSV có '+total+' dòng cho '+pairs.length+' ô.'
        +(res.mapped?' Cột key đã được gắn với tiêu đề trên form.':'')
        +(res.fmt?' AI trả về '+res.fmt+' thay vì CSV chuẩn, trang đã tự chuyển sang CSV.':'')
        +(res.cut?' Phản hồi bị cắt giữa chừng nên đã bỏ dòng cuối; hãy tăng maxTokens hoặc giảm dữ liệu.':'')
        +(res.dropped?' Đã bỏ '+res.dropped+' dòng không hợp lệ (lời dẫn hoặc key lạ).':'')+aiNote;
    }else{
      const head=String(raw||'').replace(/\s+/g,' ').trim().slice(0,150);
      msg.textContent='Không đọc được CSV từ phản hồi của AI'+(res.why?': '+res.why:'')+'.'+(head?' 150 ký tự đầu: “'+head+'”.':'')+' Nội dung thô được hiển thị bên dưới.'+aiNote;
    }
  }catch(e){
    const net=e instanceof TypeError;
    msg.textContent='Lỗi gọi AI: '+(e&&e.message?e.message:e)+(net?'. Không kết nối được tới worker. Kiểm tra AI_CONFIG.workerUrl, mạng, và Access-Control-Allow-Origin của worker phải khớp địa chỉ trang đang mở. Trang đã đăng trong claude.ai không gọi được worker, hãy mở bản chạy trên GitHub Pages của bạn.':'');
  }finally{aiBusy=false;btn.disabled=false;btn.textContent=old}
}

async function downloadAICSV(){
  if(!aiCSV)return;
  const name='danh-gia-ai-'+$('#pProv').value+'-'+($('#pMode').value||'tat-ca').toLowerCase()+'-'+new Date().toISOString().slice(0,10)+'.csv';
  const data=String.fromCharCode(0xFEFF)+aiCSV;
  const msg=$('#pMsg');
  try{
    const dl=window.claude&&window.claude.use?await window.claude.use('downloads'):null;
    if(dl){await dl.save({filename:name,data});msg.textContent='Đã lưu '+name;return}
  }catch(e){
    if(e&&e.code==='declined'){msg.textContent='Bạn đã hủy tải file.';return}
  }
  try{
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));
    a.download=name;document.body.append(a);a.click();a.remove();
    msg.textContent='Đã tải '+name;
  }catch(e){msg.textContent='Không tải được file. Hãy sao chép nội dung CSV trong ô kết quả.'}
}
(function(){const sel=$('#pProv'),P=AI_CONFIG.providers,ks=Object.keys(P);ks.forEach(k=>sel.append(h('option',{value:k},P[k].label||k)));sel.value=P[AI_CONFIG.provider]?AI_CONFIG.provider:ks[0];sel.onchange=resetAI})();
$('#pAI').onclick=runAIReview;
$('#pDl').onclick=downloadAICSV;

/* ---------- khởi động ---------- */
$('#m-IDA').setAttribute('aria-pressed',mode==='IDA');
$('#m-EDA').setAttribute('aria-pressed',mode==='EDA');
render();
syncPairs();
