/* ===== CẤU HÌNH AI REVIEW: điền khóa API và prompt của bạn tại đây ===== */
const AI_CONFIG={
  provider:'sample',   // mô hình được chọn sẵn trong hộp thoại: 'anthropic' | 'openai' | 'gemini' | 'sample'
  maxTokens:8000,
  includeMeta:true,    // gửi kèm nhãn, phần, bắt buộc và bảng mã của từng key
  providers:{
    anthropic:{label:'Claude (Anthropic)',apiKey:'',model:'',endpoint:''},  // model ví dụ: 'claude-sonnet-4-6'
    openai:{label:'GPT (OpenAI)',apiKey:'',model:'',endpoint:''},           // model ví dụ: 'gpt-4o'
    gemini:{label:'Gemini (Google)',apiKey:'',model:'',endpoint:''},        // model ví dụ: 'gemini-2.5-flash' (dùng đúng mã model trong tài khoản của bạn)
    sample:{label:'Claude qua claude.ai (thử, không cần khóa)'}             // chỉ chạy khi trang mở trong claude.ai
  },                   // apiKey: khóa của bạn. endpoint (tùy chọn): URL proxy riêng. Không để khóa khi đăng trang công khai
  prompt:'Bạn là chuyên gia nghiệp vụ hải quan Việt Nam. Hãy đánh giá tính đúng đắn nghiệp vụ của từng cặp [key, value] trong bản nháp tờ khai bên dưới. Chỉ trả về MỘT bảng CSV, không giải thích thêm, với các cột: key,value,danh_gia,ly_do,de_xuat. Cột danh_gia nhận một trong: DUNG, SAI, CAN_XEM_LAI, THIEU. Mỗi cặp [key, value] đúng một dòng.'  // PROMPT MẪU, hãy thay bằng prompt của bạn
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
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>e.classList.remove('show'),2200)}

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
const KEY='hq-draft-v1';
const blank=()=>({f:{dv_tl:'KGM',mt:'USD'},lines:[{}],chk:{},att:{},files:[]});
let mode='IDA';
let store={IDA:blank(),EDA:blank()};
let showAll=false;
let SEC=build(mode);
try{const raw=localStorage.getItem(KEY);if(raw){const o=JSON.parse(raw);if(o&&o.store){store={...store,...o.store};mode=o.mode||'IDA';SEC=build(mode)}}}catch(e){}
const st=()=>store[mode];
let saveT;
function save(){clearTimeout(saveT);saveT=setTimeout(()=>{syncStoreFromForm();try{localStorage.setItem(KEY,JSON.stringify({mode,store}))}catch(e){}syncPairs()},300)}

/* ---------- lưu dữ liệu review dạng [key, value] vào localStorage ---------- */
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
  try{localStorage.setItem(PAIRS_KEY,JSON.stringify(memPairs));localStorage.setItem(META_KEY,JSON.stringify(memMeta))}catch(e){}
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
  const ty=num(f.ty_gia);
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
  return {tot,fees,base,s1,s2};
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
const fileCache=new Map();   // id -> File (trong bộ nhớ)
const FileDB={               // lưu nội dung tệp bền trong IndexedDB của trình duyệt
  db:null,
  open(){
    return new Promise((res,rej)=>{
      if(this.db)return res(this.db);
      try{
        const rq=indexedDB.open('hq-draft-files',1);
        rq.onupgradeneeded=()=>rq.result.createObjectStore('files');
        rq.onsuccess=()=>{this.db=rq.result;res(this.db)};
        rq.onerror=()=>rej(rq.error);
      }catch(e){rej(e)}
    });
  },
  async tx(mode,fn){
    const db=await this.open();
    return new Promise((res,rej)=>{
      const t=db.transaction('files',mode),rq=fn(t.objectStore('files'));
      t.oncomplete=()=>res(rq&&rq.result);t.onerror=()=>rej(t.error);t.onabort=()=>rej(t.error);
    });
  },
  put(id,blob){return this.tx('readwrite',o=>o.put(blob,id))},
  get(id){return this.tx('readonly',o=>o.get(id))},
  del(id){return this.tx('readwrite',o=>o.delete(id))}
};
function fmtSize(b){return b<1024?b+' B':b<1048576?fmtN(b/1024,0)+' KB':fmtN(b/1048576,1)+' MB'}
function guessType(name){
  const n=noDiacritics(name).toLowerCase().replace(/\.[a-z0-9]+$/,'');
  const t=n.split(/[^a-z0-9]+/).filter(Boolean);
  if(n.includes('hoa don')||t.includes('invoice')||t.includes('inv'))return 0;
  if(n.includes('packing')||t.includes('pl')||t.includes('pkl'))return 1;
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
function addFiles(list){
  const s=st();s.files=s.files||[];
  const msgs=[];
  Array.from(list||[]).forEach(f=>{
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    if(EXT_OK.indexOf(ext)<0){msgs.push('Bỏ qua “'+f.name+'”: định dạng .'+ext+' chưa được hỗ trợ');return}
    if(f.size>MAX_FILE){msgs.push('Bỏ qua “'+f.name+'”: vượt '+fmtSize(MAX_FILE));return}
    if(s.files.some(x=>x.name===f.name&&x.size===f.size)){msgs.push('Bỏ qua “'+f.name+'”: đã có trong danh sách');return}
    if(s.files.length>=MAX_FILES){msgs.push('Đã đủ '+MAX_FILES+' tệp');return}
    const id='f'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),t=guessType(f.name);
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
  box.append(control(fd,id,get,set));
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
function renderLines(host){
  const imp=mode==='IDA',LF=LINEF(imp),s=st();
  host.innerHTML='';
  s.lines.forEach((l,i)=>{
    const card=h('div',{class:'line'});
    card.append(h('div',{class:'lh'},h('span',{},'Dòng hàng '+(i+1)),h('span',{class:'t'},
      h('button',{class:'btn small',type:'button',onclick:()=>{s.lines.splice(i+1,0,{...l});renderLines(host);refresh();save()}},'Nhân bản'),
      h('button',{class:'btn small danger',type:'button',onclick:()=>{s.lines.splice(i,1);if(!s.lines.length)s.lines.push({});renderLines(host);refresh();save()}},'Xóa'))));
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
    if(imp)setVal('l-'+i+'-t2',l.base?fmtN(l.t2):'');
  });
  const T=$('#totals');
  if(T){
    T.innerHTML='';
    const add=(a,b,big)=>T.append(h('div',{class:'tot'+(big?' big':'')},h('small',{},a),h('b',{},b)));
    add('Tổng trị giá hóa đơn',fmtN(c.tot,2)+' '+(s.f.mt||''));
    add(imp?'Tổng trị giá tính thuế (VND)':'Tổng trị giá tính thuế XK (VND)',fmtN(c.base));
    add(imp?'Thuế nhập khẩu tạm tính (VND)':'Thuế xuất khẩu tạm tính (VND)',fmtN(c.s1));
    if(imp)add('Thuế GTGT tạm tính (VND)',fmtN(c.s2));
    add('Tổng thuế tạm tính (VND)',fmtN(c.s1+c.s2),true);
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
let resetArm=0;
$('#bReset').onclick=e=>{
  if(!resetArm){resetArm=1;e.target.textContent='Bấm lần nữa để xóa';setTimeout(()=>{resetArm=0;e.target.textContent='Xóa bản nháp'},3000);return}
  (st().files||[]).forEach(x=>{fileCache.delete(x.id);FileDB.del(x.id).catch(()=>{})});
  store[mode]=blank();showAll=false;resetArm=0;e.target.textContent='Xóa bản nháp';render();save();toast('Đã xóa bản nháp '+(mode==='IDA'?'nhập khẩu':'xuất khẩu'));
};
/* ---------- hộp thoại dữ liệu review ---------- */
const dlg2=$('#dlg2');
function showPairs(){
  syncPairs();
  const m=$('#pMode').value,arr=getPairs(m);
  $('#pBox').value='['+NL+arr.map(p=>'  '+JSON.stringify(p)).join(','+NL)+NL+']';
  $('#pInfo').textContent='Đã lưu '+getPairs().length+' cặp [key, value] của cả IDA và EDA vào localStorage, khóa “'+PAIRS_KEY+'”. Nhãn, phần và bảng mã của từng key nằm ở khóa “'+META_KEY+'”. Đang hiển thị '+arr.length+' cặp.';
  $('#pMsg').textContent='';
}
$('#bPairs').onclick=()=>{$('#pMode').value=mode;showPairs();resetAI();dlg2.showModal()};
$('#pMode').onchange=()=>{showPairs();resetAI()};
$('#pClose').onclick=()=>dlg2.close();
/* ---------- AI review ---------- */
let aiCSV='',aiBusy=false,aiNote='';
function resetAI(){aiCSV='';aiNote='';$('#pDl').hidden=true;$('#pOut').hidden=true;$('#pOut').value='';$('#pMsg').textContent=''}

async function callAI(text,prov){
  const c=AI_CONFIG,p=(c.providers&&c.providers[prov])||{};
  aiNote='';
  const need=()=>{
    if(!p.apiKey)throw new Error('Chưa điền AI_CONFIG.providers.'+prov+'.apiKey');
    if(!p.model)throw new Error('Chưa điền AI_CONFIG.providers.'+prov+'.model');
  };
  if(prov==='anthropic'){
    need();
    const r=await fetch(p.endpoint||'https://api.anthropic.com/v1/messages',{method:'POST',headers:{'content-type':'application/json','x-api-key':p.apiKey,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'},body:JSON.stringify({model:p.model,max_tokens:c.maxTokens,messages:[{role:'user',content:text}]})});
    if(!r.ok)throw new Error('Anthropic API '+r.status+': '+(await r.text()).slice(0,300));
    const j=await r.json();
    if(j.stop_reason==='max_tokens')aiNote=' Kết quả có thể bị cắt do hết max_tokens.';
    return (j.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
  }
  if(prov==='openai'){
    need();
    const r=await fetch(p.endpoint||'https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'content-type':'application/json','authorization':'Bearer '+p.apiKey},body:JSON.stringify({model:p.model,messages:[{role:'user',content:text}],max_completion_tokens:c.maxTokens})});
    if(!r.ok)throw new Error('OpenAI API '+r.status+': '+(await r.text()).slice(0,300));
    const j=await r.json();
    const ch=(j.choices&&j.choices[0])||{};
    if(ch.finish_reason==='length')aiNote=' Kết quả có thể bị cắt do hết max tokens.';
    return (ch.message&&ch.message.content)||'';
  }
  if(prov==='gemini'){
    need();
    const url=p.endpoint||('https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(p.model)+':generateContent');
    const r=await fetch(url,{method:'POST',headers:{'content-type':'application/json','x-goog-api-key':p.apiKey},body:JSON.stringify({contents:[{role:'user',parts:[{text:text}]}],generationConfig:{maxOutputTokens:c.maxTokens}})});
    if(!r.ok)throw new Error('Gemini API '+r.status+': '+(await r.text()).slice(0,300));
    const j=await r.json();
    const cand=(j.candidates&&j.candidates[0])||{};
    if(cand.finishReason==='MAX_TOKENS')aiNote=' Kết quả có thể bị cắt do hết maxOutputTokens.';
    const out=((cand.content&&cand.content.parts)||[]).map(x=>x.text||'').join('');
    if(!out){
      const why=(j.promptFeedback&&j.promptFeedback.blockReason)||cand.finishReason||'rỗng';
      throw new Error('Gemini không trả nội dung ('+why+')');
    }
    return out;
  }
  const sm=window.claude&&window.claude.use?await window.claude.use('sample'):null;
  if(!sm)throw new Error('Chế độ sample chỉ chạy khi trang được mở trong claude.ai');
  const r=await sm(text,{modelTier:'default',cache:false});
  if(r.truncated)aiNote=' Kết quả có thể bị cắt ngắn.';
  return r.text;
}

function extractCSV(raw){
  let t=String(raw||'').split(String.fromCharCode(13)).join('').trim();
  const a=t.indexOf('```');
  if(a>-1){const nl=t.indexOf(NL,a);const b=t.indexOf('```',nl+1);t=(b>-1?t.slice(nl+1,b):t.slice(nl+1)).trim()}
  const lines=t.split(NL).filter(x=>x.trim());
  const head=(lines[0]||'').toLowerCase();
  return {ok:lines.length>=2&&head.indexOf(',')>-1&&head.indexOf('key')>-1,text:t,rows:Math.max(lines.length-1,0)};
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
  const names={danh_gia:'Đánh giá',ly_do:'Lý do',de_xuat:'Đề xuất'};
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

async function runAIReview(){
  if(aiBusy)return;
  const c=AI_CONFIG,btn=$('#pAI'),msg=$('#pMsg');
  showPairs();
  resetAI();
  const pairs=readPairsFromForm();
  if(!pairs){msg.textContent='Dữ liệu trong form không phải mảng [key, value] hợp lệ.';return}
  if(!pairs.length){msg.textContent='Chưa có dữ liệu để review.';return}
  if(!c.prompt||!c.prompt.trim()){msg.textContent='Chưa điền AI_CONFIG.prompt.';return}
  let text=c.prompt.trim()+NL+NL+'DỮ LIỆU [key, value]:'+NL+JSON.stringify(pairs);
  if(c.includeMeta){
    const all=(getMeta().fields)||{},sub={};
    pairs.forEach(p=>{if(all[p[0]])sub[p[0]]=all[p[0]]});
    text+=NL+NL+'THÔNG TIN TỪNG KEY (nhãn, phần, bắt buộc, bảng mã):'+NL+JSON.stringify(sub);
  }
  aiBusy=true;btn.disabled=true;
  const old=btn.textContent;btn.textContent='Đang review…';
  msg.textContent='Đang gửi '+pairs.length+' cặp [key, value] trong form cho '+(($('#pProv').selectedOptions[0]||{}).textContent||'AI')+'…';
  try{
    const raw=await callAI(text,$('#pProv').value);
    const res=extractCSV(raw);
    if(res.ok){const mp=mapCSVToTitles(res.text,pairs);if(mp){res.text=mp;res.mapped=true}}
    const out=$('#pOut');out.hidden=false;out.value=res.ok?res.text:String(raw||'');
    if(res.ok){
      aiCSV=res.text;$('#pDl').hidden=false;
      msg.textContent='AI đã review xong: '+res.rows+' dòng đánh giá cho '+pairs.length+' cặp'+(res.rows!==pairs.length?' (số dòng không khớp, hãy kiểm tra)':'')+'.'+(res.mapped?' Cột key đã được gắn với tiêu đề trên form.':'')+aiNote;
    }else{
      msg.textContent='AI không trả về CSV hợp lệ nên chưa có nút tải. Hãy kiểm tra lại prompt.'+aiNote;
    }
  }catch(e){
    const net=e instanceof TypeError;
    msg.textContent='Lỗi gọi AI: '+(e&&e.message?e.message:e)+(net?'. Trình duyệt đã chặn kết nối (CORS hoặc chính sách bảo mật của trang đã đăng). Hãy chạy file trên máy hoặc máy chủ của bạn, dùng proxy, hoặc đặt provider là sample.':'');
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
