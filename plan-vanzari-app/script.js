/**************************
 * STARE & UTILITARE
 **************************/
const LS_KEY_PLANURI = "planuri_vanzari";
const LS_KEY_SETTINGS = "planuri_settings";

const defaultSettings = {
  percentImplicit: 10,
  operatori: ["Operator 1","Operator 2","Operator 3"],
  procente: [50,30,20] // trebuie să însumeze ~100
};

let settings = loadSettings();
let chartTotal, chartOperatori;

/**************************
 * INIT UI
 **************************/
/**************************
 * INIT UI - VARIANTĂ CORECTĂ
 **************************/
document.addEventListener("DOMContentLoaded", () => {
  // Populate setări în modal
  fillSettingsUI();

  // Construiește tabel operatori din setări
  buildOperatorTable();

  // Hook butoane
  document.getElementById("openSettingsBtn").addEventListener("click", openSettings);
  document.getElementById("closeSettingsBtn").addEventListener("click", closeSettings);
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
  document.getElementById("calculeazaBtn").addEventListener("click", calculeazaPlanImbunatatit);
  document.getElementById("salveazaBtn").addEventListener("click", salveazaLuna);
  document.getElementById("stergeToateBtn").addEventListener("click", stergeTotIstoricul);
  document.getElementById("exportPdfBtn").addEventListener("click", exportPDF);

  // Filtru lună
  document.getElementById("filtruLuna").addEventListener("change", renderIstoricSiGrafice);

  // Set % implicit dacă e gol
  const procentInput = document.getElementById("procentCrestere");
  if (!procentInput.value) procentInput.value = settings.percentImplicit;

  // Setează luna curentă automat
  const lunaCurenta = new Date().getMonth();
  document.getElementById("selectLuna").value = lunaCurenta;

  // Event listener pentru modificări în inputuri
  document.addEventListener('input', function(e) {
    if (e.target.classList.contains('plan-op')) {
      updatePlanTotal();
      updatePonderiSiRealizat();
    }
    if (e.target.classList.contains('rez-op')) {
      updatePonderiSiRealizat();
    }
  });

  // Rander inițial
  renderIstoricSiGrafice();
  
  // Actualizează inițial
  setTimeout(updatePonderiSiRealizat, 100);
});

/**************************
 * SETTINGS
 **************************/
function loadSettings(){
  try{
    const raw = localStorage.getItem(LS_KEY_SETTINGS);
    if(!raw){ localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(defaultSettings)); return {...defaultSettings}; }
    const obj = JSON.parse(raw);
    // sanity
    obj.percentImplicit = isFinite(obj.percentImplicit) ? obj.percentImplicit : defaultSettings.percentImplicit;
    obj.operatori = Array.isArray(obj.operatori) && obj.operatori.length ? obj.operatori : [...defaultSettings.operatori];
    obj.procente = Array.isArray(obj.procente) && obj.procente.length ? obj.procente : [...defaultSettings.procente];
    return obj;
  }catch{
    localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(defaultSettings));
    return {...defaultSettings};
  }
}

function fillSettingsUI(){
  document.getElementById("setPercentImplicit").value = settings.percentImplicit;
  document.getElementById("setOperatori").value = settings.operatori.join("\n");
  document.getElementById("setProcente").value = settings.procente.join(", ");
}

function openSettings(){ document.getElementById("settingsModal").classList.remove("hidden"); }
function closeSettings(){ document.getElementById("settingsModal").classList.add("hidden"); }

function saveSettings(){
  const percent = parseFloat(document.getElementById("setPercentImplicit").value) || 0;
  const opLines = document.getElementById("setOperatori").value.split("\n").map(s=>s.trim()).filter(Boolean);
  let procente = document.getElementById("setProcente").value.split(",").map(s=>parseFloat(s.trim())).filter(n=>isFinite(n));

  if(opLines.length === 0){
    alert("Adaugă cel puțin un operator.");
    return;
  }
  if(procente.length !== opLines.length){
    // dacă nu corespunde numărul, împărțim egal
    procente = Array(opLines.length).fill( Math.round(100/opLines.length) );
    // ultima celulă ia diferența
    const sum = procente.reduce((a,b)=>a+b,0);
    procente[procente.length-1] += 100 - sum;
  } else {
    const sum = procente.reduce((a,b)=>a+b,0);
    // normalizează la 100
    if(sum !== 100){
      const ratio = 100/sum;
      procente = procente.map((p,i)=>{
        if(i===procente.length-1){
          const partial = Math.round(procente.slice(0,-1).map(x=>x*ratio).reduce((a,b)=>a+b,0));
          return 100 - partial;
        }
        return Math.round(p*ratio);
      });
    }
  }

  settings = { percentImplicit: percent, operatori: opLines, procente };
  localStorage.setItem(LS_KEY_SETTINGS, JSON.stringify(settings));

  // Reconstruiește tabelul operatori
  buildOperatorTable();

  closeSettings();
}

/**************************
 * UI — OPERATORI
 **************************/
function buildOperatorTable(){
  const tbody = document.getElementById("operatoriTbody");
  tbody.innerHTML = "";
  settings.operatori.forEach((name, idx)=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${name}</td>
      <td><input type="number" class="plan-op" data-idx="${idx}" value="0"></td>
      <td><input type="number" class="rez-op" data-idx="${idx}" value=""></td>
      <td><span class="badge" id="realizat-${idx}">0%</span></td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById("planTotalFooter").value = 0;
  document.getElementById("rezTotal").value = "";
  document.getElementById("realizatTotal").textContent = "0%";
  document.getElementById("realizatTotal").className = "badge";
}

/**************************
 * CALCUL PLAN
 **************************/
// Ștergeți orice altă definiție a funcției cu nume asemănător și păstrați doar aceasta:
function calculeazaPlanImbunatatit() {
  const lp = parseFloat(document.getElementById("lunaPrecedenta").value) || 0;
  const lt = parseFloat(document.getElementById("lunaAnTrecut").value) || 0;
  const pct = parseFloat(document.getElementById("procentCrestere").value || settings.percentImplicit) || 0;
  
  // Preia luna selectată
  const selectLuna = document.getElementById("selectLuna");
  const lunaIndex = parseInt(selectLuna.value);
  
  // Factor de sezonalitate automat bazat pe lună
  const factorSezonalitate = calculeazaFactorSezonalitate(lunaIndex);
  
  const factorEl = document.getElementById("factorAfisat");
if (factorEl) {
  factorEl.textContent = `Factor sezonalitate: ${factorSezonalitate}x`;
}

  // Medie ponderată (mai multă importanță lunii precedente)
  const mediePonderata = (lp * 0.7) + (lt * 0.3);
  
  // Calcul plan cu corecție sezonieră
  const planGeneral = Math.round(mediePonderata * (1 + pct/100) * factorSezonalitate);
  
  document.getElementById("planTotal").value = planGeneral;
  
  // Distribuie pe operatori
  let suma = 0;
  settings.procente.forEach((p, idx) => {
    const val = idx === settings.procente.length - 1 
      ? (planGeneral - suma) 
      : Math.round(planGeneral * (p/100));
    
    document.querySelector(`.plan-op[data-idx="${idx}"]`).value = val;
    suma += val;
  });

  updatePlanTotal();
  updatePonderiSiRealizat();
}

function calculeazaFactorSezonalitate(luna) {
    // Factori de sezonalitate pe lună - ajustează după necesități
    const factori = {
        0: 0.9,   // Ianuarie - post-crăciun
        1: 0.95,  // Februarie
        2: 1.0,   // Martie
        3: 1.05,  // Aprilie
        4: 1.1,   // Mai
        5: 1.05,  // Iunie
        6: 0.95,  // Iulie - vacanțe
        7: 0.9,   // August - vacanțe
        8: 1.0,   // Septembrie
        9: 1.15,  // Octombrie
        10: 1.25, // Noiembrie - Black Friday
        11: 1.3   // Decembrie - sărbători
    };
    
    return factori[luna] || 1.0;
}
function ratioClass(r){
  if(r >= 100) return "good";
  if(r >= 90) return "warn";
  return "bad";
}
function updatePonderiSiRealizat() {
  let totalPlan = 0;
  let totalRez = 0;
  
  // Mai întâi calculăm totalurile
  settings.operatori.forEach((_, idx) => {
    const plan = parseFloat(document.querySelector(`.plan-op[data-idx="${idx}"]`).value) || 0;
    const rez = parseFloat(document.querySelector(`.rez-op[data-idx="${idx}"]`).value) || 0;
    
    totalPlan += plan;
    totalRez += rez;
  });

  // Apoi actualizăm interfața pentru fiecare operator
  settings.operatori.forEach((_, idx) => {
    const plan = parseFloat(document.querySelector(`.plan-op[data-idx="${idx}"]`).value) || 0;
    const rez = parseFloat(document.querySelector(`.rez-op[data-idx="${idx}"]`).value) || 0;

    // procent realizat operator
    const ratio = plan ? Math.round(rez / plan * 100) : 0;
    const badgeR = document.getElementById(`realizat-${idx}`);
    if (badgeR) {
      badgeR.textContent = `${ratio}%`;
      badgeR.className = "badge " + ratioClass(ratio);
    }
  });

  // update total plan și rezultat în tabel (General)
  const planTotalElement = document.getElementById("planTotalFooter");
  const rezTotalElement = document.getElementById("rezTotal");
  const realizatTotalElement = document.getElementById("realizatTotal");
  
  if (planTotalElement) planTotalElement.textContent = totalPlan;
  if (rezTotalElement) rezTotalElement.textContent = totalRez;

  // calcul procent General - CORECTAT
  const totalRatio = totalPlan ? Math.round((totalRez / totalPlan) * 100) : 0;
  if (realizatTotalElement) {
    realizatTotalElement.textContent = `${totalRatio}%`;
    realizatTotalElement.className = "badge " + ratioClass(totalRatio);
  }
}

// Funcția pentru clasele de stil în funcție de procent
function ratioClass(r) {
  if (r >= 100) return "good";
  if (r >= 90) return "warn";
  return "bad";
}

// Ascultă evenimentele de input pe câmpurile de rezultate
// Adaugă acest cod în secțiunea de inițializare (DOMContentLoaded)
document.addEventListener('input', function(e) {
  if (e.target.classList.contains('plan-op')) {
    updatePlanTotal();
    updatePonderiSiRealizat();
  }
});

function updatePlanTotal() {
  let totalPlan = 0;
  
  settings.operatori.forEach((_, idx) => {
    const plan = parseFloat(document.querySelector(`.plan-op[data-idx="${idx}"]`).value) || 0;
    totalPlan += plan;
  });

  // Actualizează totalul planului
  const planTotalElement = document.getElementById("planTotalFooter");
  if (planTotalElement) {
    planTotalElement.textContent = totalPlan;
  }
  
  // Actualizează și câmpul de plan total din formular (dacă există)
  const planTotalInput = document.getElementById("planTotal");
  if (planTotalInput) {
    planTotalInput.value = totalPlan;
  }
}

/**************************
 * SALVARE & ISTORIC
 **************************/
function getIstoric(){ try{ return JSON.parse(localStorage.getItem(LS_KEY_PLANURI)) || []; }catch{ return []; } }
function setIstoric(arr){ localStorage.setItem(LS_KEY_PLANURI, JSON.stringify(arr)); }

function salveazaLuna(){
 const selectLuna = document.getElementById("selectLuna");
const luna = selectLuna.options[selectLuna.selectedIndex].text;
  if(!luna){ alert("Te rog completează denumirea lunii (ex. August 2025)."); return; }

  const planTotal = parseFloat(document.getElementById("planTotalFooter").textContent) || 0;
const rezTotal  = parseFloat(document.getElementById("rezTotal").textContent) || 0;

  const operatori = settings.operatori.map((name, idx)=>({
    name,
    plan: parseFloat(document.querySelector(`.plan-op[data-idx="${idx}"]`).value) || 0,
    rez:  parseFloat(document.querySelector(`.rez-op[data-idx="${idx}"]`).value) || 0,
  }));

  // Limita de luni curente vizibile
const LIMITA_LUNI = 24;

function mutaInArhivaDacaDepasesteLimita() {
  const container = document.getElementById("luniContainer");
  const arhiva = document.getElementById("arhivaContainer");

  const luni = container.querySelectorAll(".luna-card");
  if (luni.length > LIMITA_LUNI) {
    // mută cea mai veche lună (prima din listă)
    const primaLuna = luni[0];
    arhiva.appendChild(primaLuna);
  }
}

document.getElementById("salveazaBtn").addEventListener("click", ()=>{
   // ... codul tău de salvare existent ...
   mutaInArhivaDacaDepasesteLimita();
});



  const item = {
    id: Date.now(),
    luna,
    planTotal, rezTotal,
    operatori
  };

  const ist = getIstoric();
  ist.push(item);
  setIstoric(ist);

  // actualizează UI
  renderIstoricSiGrafice();

  // adaugă/actualizează opțiuni filtrare
  buildFiltruLuni();

  // curăță doar câmpurile de rezultat (opțional)
  operatori.forEach((_, idx)=>{ document.querySelector(`.rez-op[data-idx="${idx}"]`).value = ""; });
  document.getElementById("rezTotal").value = "";
}

function stergeTotIstoricul(){
  if(!confirm("Ești sigur că vrei să ștergi TOT istoricul?")) return;
  setIstoric([]);
  renderIstoricSiGrafice();
  buildFiltruLuni();
}

function stergeLuna(id){
  const ist = getIstoric().filter(x=>x.id !== id);
  setIstoric(ist);
  renderIstoricSiGrafice();
  buildFiltruLuni();
}
/**************************
 * RENDER ISTORIC + GRAFICE
 **************************/
function buildFiltruLuni(){
  const select = document.getElementById("filtruLuna");
  const valCur = select.value;
  const ist = getIstoric();
  const luni = Array.from(new Set(ist.map(x=>x.luna)));
  select.innerHTML = `<option value="__ALL__">Toate</option>` + luni.map(l=>`<option value="${l}">${l}</option>`).join("");
  if(luni.includes(valCur)) select.value = valCur;
}

function renderIstoricSiGrafice(){
  const istoricDiv = document.getElementById("istoric");
  const select = document.getElementById("filtruLuna");
  const filter = select.value;

  const ist = getIstoric();
  const afis = filter==="__ALL__" ? ist : ist.filter(x=>x.luna===filter);

  // RENDER LISTĂ
  istoricDiv.innerHTML = "";
  afis.slice().reverse().forEach(item=>{
    const ratio = item.planTotal ? Math.round(item.rezTotal/item.planTotal*100) : 0;
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div class="row">
        <div><strong>${item.luna}</strong></div>
        <div>Plan total: <strong>${fmt(item.planTotal)}</strong></div>
        <div>Realizat: <strong>${fmt(item.rezTotal)}</strong></div>
        <div>% realizat: <span class="badge ${ratioClass(ratio)}">${ratio}%</span></div>
        <div style="text-align:right;"><button class="btn danger" onclick="stergeLuna(${item.id})">🗑️ Șterge</button></div>
      </div>
      <div class="table-wrap" style="margin-top:10px;">
        <table>
          <thead><tr><th>Operator</th><th>Plan</th><th>Realizat</th><th>% realizat</th></tr></thead>
          <tbody>
            ${item.operatori.map(op=>{
              const r = op.plan ? Math.round(op.rez/op.plan*100) : 0;
              return `<tr>
                <td>${op.name}</td>
                <td>${fmt(op.plan)}</td>
                <td>${fmt(op.rez)}</td>
                <td><span class="badge ${ratioClass(r)}">${r}%</span></td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    `;
    istoricDiv.appendChild(div);
  });

  // RENDER GRAFICE
  renderCharts(filter);
}

function fmt(n){ return (n||0).toLocaleString("ro-RO"); }

function renderCharts(filter){
  const ist = getIstoric();
  const dataset = filter==="__ALL__" ? ist : ist.filter(x=>x.luna===filter);

  // Total chart (bar: plan vs realizat pe luni)
  const labels = dataset.map(x=>x.luna);
  const planData = dataset.map(x=>x.planTotal);
  const rezData  = dataset.map(x=>x.rezTotal);

  const ctxTotal = document.getElementById("chartTotal").getContext("2d");
  if(chartTotal) chartTotal.destroy();
  chartTotal = new Chart(ctxTotal, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Plan total', data: planData },
        { label: 'Realizat total', data: rezData }
      ]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ position:'bottom' } },
      scales:{ y:{ beginAtZero:true } }
    }
  });

  // Operator chart for selected month (stacked or simple)
  const ctxOps = document.getElementById("chartOperatori").getContext("2d");
  if(chartOperatori) chartOperatori.destroy();
  if(filter==="__ALL__" || dataset.length!==1){
    chartOperatori = new Chart(ctxOps, {
      type: 'bar',
      data: {
        labels: ["Selectează o singură lună din filtru pentru detaliu pe operatori"],
        datasets: [{ label:"", data:[0] }]
      },
      options: {responsive:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}}}
    });
  } else {
    const only = dataset[0];
    const names = only.operatori.map(o=>o.name);
    const plans = only.operatori.map(o=>o.plan);
    const rezs  = only.operatori.map(o=>o.rez);
    chartOperatori = new Chart(ctxOps, {
      type:'bar',
      data:{
        labels:names,
        datasets:[
          { label:'Plan', data:plans },
          { label:'Realizat', data:rezs }
        ]
      },
      options:{responsive:true, plugins:{legend:{position:'bottom'}}, scales:{y:{beginAtZero:true}}}
    });
  }
}

buildFiltruLuni();

/**************************
 * EXPORT PDF (luna selectată)
 **************************/
async function exportPDF() {
  const filter = document.getElementById("filtruLuna").value;
  if(filter === "__ALL__") {
    alert("Selectează o singură lună din filtru pentru export PDF.");
    return;
  }

  const ist = getIstoric();
  const item = ist.find(x => x.luna === filter);
  if(!item){ 
    alert("Nu am găsit date pentru luna selectată."); 
    return; 
  }

  const report = document.getElementById("reportArea");
  report.classList.remove("hidden"); // DOM vizibil temporar

  // Titlu + dată
  document.getElementById("repTitle").textContent = `Raport luna ${item.luna}`;
  document.getElementById("repDate").textContent = `Generat la: ${new Date().toLocaleDateString("ro-RO")}`;

  // Tabel rezumat
  const ratio = item.planTotal ? Math.round(item.rezTotal/item.planTotal*100) : 0;
  const graf = `
    <div style="width:100%; background:#eee; border-radius:6px; overflow:hidden; height:16px;">
      <div style="width:${ratio}%; background:#28a745; height:100%;"></div>
    </div>
  `;
  document.getElementById("repSummaryRow").innerHTML = `
    <tr>
      <td>${fmt(item.planTotal)} lei</td>
      <td>${fmt(item.rezTotal)} lei</td>
      <td>${ratio}%</td>
    </tr>
  `;

  // Tabel operatori
  document.getElementById("repTbody").innerHTML = item.operatori.map(op => {
    const r = op.plan ? Math.round(op.rez/op.plan*100) : 0;
    return `<tr>
      <td>${op.name}</td>
      <td>${fmt(op.plan)}</td>
      <td>${fmt(op.rez)}</td>
      <td>${r}%</td>
    </tr>`;
  }).join("");

  // Așteaptă logo dacă nu s-a încărcat
  const logo = report.querySelector("img");
  if (logo && !logo.complete) {
    await new Promise(res => { logo.onload = res; });
  }

  // Grafice Chart.js
  // Grafic global tip bar
const ctxGlobal = document.getElementById("chartGlobal").getContext("2d");
new Chart(ctxGlobal, {
  type: 'bar',
  data: {
    labels: ["Plan total", "Realizat total"],
    datasets: [{
      label: "Sume (lei)",
      data: [item.planTotal, item.rezTotal],
      backgroundColor: ["#000", "#FFF300"]
    }]
  },
  options: {
    responsive: false,
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: "Plan vs Realizat total"
      }
    },
    scales: {
      y: { beginAtZero: true }
    }
  }
});


  const ctxOperators = document.getElementById("chartOperators").getContext("2d");
  new Chart(ctxOperators, {
    type: 'bar',
    data: {
      labels: item.operatori.map(o => o.name),
      datasets: [
        { label: "Plan", data: item.operatori.map(o => o.plan), backgroundColor: "#000" },
        { label: "Realizat", data: item.operatori.map(o => o.rez), backgroundColor: "#FFF300" }
      ]
    },
    options: { responsive: false }
  });

  // Așteaptă un mic delay pentru a fi siguri că graficele s-au desenat
  await new Promise(res => setTimeout(res, 300));

  // Export PDF
  const canvas = await html2canvas(report, { scale: 3, backgroundColor: "#ffffff", useCORS: true });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new window.jspdf.jsPDF("p", "pt", "a4");
  const pageW = pdf.internal.pageSize.getWidth();
  const imgW = pageW - 40;
  const imgH = canvas.height * imgW / canvas.width;
  pdf.addImage(imgData, "PNG", 20, 20, imgW, imgH);
  pdf.save(`Raport_${item.luna}.pdf`);

  report.classList.add("hidden"); // ascunde din nou DOM-ul
}
function updateExportDropdown() {
  const exportMonth = document.getElementById("exportMonth");
  exportMonth.innerHTML = '<option value="">-- alege --</option>'; // reset
  const months = JSON.parse(localStorage.getItem("months")) || [];
  months.forEach(m => {
    let opt = document.createElement("option");
    opt.value = m.month;
    opt.textContent = m.month;
    exportMonth.appendChild(opt);
  });
}
document.getElementById("exportPDF").addEventListener("click", () => {
  const selectedMonth = document.getElementById("exportMonth").value;
  if (!selectedMonth) {
    alert("Te rog selectează o lună pentru export.");
    return;
  }
  // aici faci exportul PDF pentru luna selectată
});
monthBlock.innerHTML = `
  <div class="month-header">
    <h3>${luna}</h3>
    <button class="exportBtn">Export PDF</button>
  </div>
  <table>
    <thead>
      <tr>
        <th>Operator</th>
        <th>Plan</th>
        <th>Rezultat obținut</th>
      </tr>
    </thead>
    <tbody>
      <tr>
       <td>General</td>
       <td>${planGeneral.toFixed(2)}</td>
       <td><span class="rezultat-total">0</span></td>
      </tr>
      <tr>
        <td>Operator 1</td>
        <td>${(planGeneral/3).toFixed(2)}</td>
        <td><input type="number" placeholder="Introdu rezultat"></td>
      </tr>
      <tr>
        <td>Operator 2</td>
        <td>${(planGeneral/3).toFixed(2)}</td>
        <td><input type="number" placeholder="Introdu rezultat"></td>
      </tr>
      <tr>
        <td>Operator 3</td>
        <td>${(planGeneral/3).toFixed(2)}</td>
        <td><input type="number" placeholder="Introdu rezultat"></td>
      </tr>
    </tbody>
  </table>
`;

document.addEventListener("click", function(e) {
  if (e.target.classList.contains("exportBtn")) {
    const monthBlock = e.target.closest(".month-block");
    const monthName = monthBlock.querySelector("h3").innerText;
    const table = monthBlock.querySelector("table");

    // clonăm tabelul ca să nu modificăm DOM-ul original
    const tableClone = table.cloneNode(true);

    const opt = {
      margin: 0.5,
      filename: monthName + ".pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "in", format: "a4", orientation: "portrait" }
    };

    html2pdf().from(tableClone).set(opt).save();
  }

  document.getElementById("planForm").addEventListener("submit", function(e) {
  e.preventDefault();
  // ... codul de calcul și creare monthBlock ...

  document.getElementById("monthsContainer").appendChild(monthBlock);

  // 🔹 RESETARE FORM după adăugare
  e.target.reset();
});

});


