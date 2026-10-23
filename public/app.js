// Northwind Analytics Dashboard Frontend Application

let currentTab = 'overview';
let activeFilters = {
  year: '',
  categoryid: '',
  employeeid: '',
  country: ''
};

// Charts references
let monthlyChart = null;
let categoryChart = null;
let countryChart = null;
let rfmDonutChart = null;
let rfmRevenueChart = null;
let topProductsChart = null;
let employeesChart = null;
let logisticsVolChart = null;
let logisticsDaysChart = null;

let allRfmCustomers = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  await loadFilterOptions();
  await refreshDashboard();
});

// Format currency
function formatCurrency(val) {
  if (val === null || val === undefined || isNaN(val)) return '$0.00';
  return '$' + Number(val).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatNumber(val) {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return Number(val).toLocaleString('en-US');
}

// Build Query string
function getQueryString() {
  const params = new URLSearchParams();
  if (activeFilters.year) params.append('year', activeFilters.year);
  if (activeFilters.categoryid) params.append('categoryid', activeFilters.categoryid);
  if (activeFilters.employeeid) params.append('employeeid', activeFilters.employeeid);
  if (activeFilters.country) params.append('country', activeFilters.country);
  const str = params.toString();
  return str ? `?${str}` : '';
}

// Load Dropdown Options
async function loadFilterOptions() {
  try {
    const res = await fetch('/api/filters');
    const data = await res.json();

    const yearSelect = document.getElementById('filter-year');
    data.years.forEach(y => {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = `Año: ${y}`;
      yearSelect.appendChild(opt);
    });

    const catSelect = document.getElementById('filter-category');
    data.categories.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.categoryid;
      opt.textContent = `Cat: ${c.categoryname}`;
      catSelect.appendChild(opt);
    });

    const empSelect = document.getElementById('filter-employee');
    data.employees.forEach(e => {
      const opt = document.createElement('option');
      opt.value = e.employeeid;
      opt.textContent = `Emp: ${e.name}`;
      empSelect.appendChild(opt);
    });

    const countrySelect = document.getElementById('filter-country');
    data.countries.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c;
      opt.textContent = `País: ${c}`;
      countrySelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading filters:', err);
  }
}

// Filter triggers
function applyFilters() {
  activeFilters.year = document.getElementById('filter-year').value;
  activeFilters.categoryid = document.getElementById('filter-category').value;
  activeFilters.employeeid = document.getElementById('filter-employee').value;
  activeFilters.country = document.getElementById('filter-country').value;
  refreshDashboard();
}

function resetFilters() {
  document.getElementById('filter-year').value = '';
  document.getElementById('filter-category').value = '';
  document.getElementById('filter-employee').value = '';
  document.getElementById('filter-country').value = '';
  activeFilters = { year: '', categoryid: '', employeeid: '', country: '' };
  refreshDashboard();
}

// Tab Switching
function switchTab(tabId) {
  currentTab = tabId;
  const tabs = ['overview', 'rfm', 'products', 'employees', 'logistics', 'audit'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-${t}`);
    const sec = document.getElementById(`section-${t}`);
    if (t === tabId) {
      btn.className = 'py-3 px-1 tab-active flex items-center space-x-2 whitespace-nowrap';
      sec.classList.remove('hidden');
    } else {
      btn.className = 'py-3 px-1 text-slate-500 hover:text-slate-800 flex items-center space-x-2 whitespace-nowrap';
      sec.classList.add('hidden');
    }
  });

  if (tabId === 'rfm') loadRFMData();
  if (tabId === 'products') loadProductsData();
  if (tabId === 'employees') loadEmployeesData();
  if (tabId === 'logistics') loadLogisticsData();
  if (tabId === 'audit') fetchAuditStatus();
}

// Refresh Current Dashboard View
async function refreshDashboard() {
  await Promise.all([
    loadKPIs(),
    loadMonthlyTrend(),
    loadCategoryChart(),
    loadCountryChart(),
    loadQuickTopProducts()
  ]);

  if (currentTab === 'rfm') loadRFMData();
  if (currentTab === 'products') loadProductsData();
  if (currentTab === 'employees') loadEmployeesData();
  if (currentTab === 'logistics') loadLogisticsData();
}

// 1. KPI Loading
async function loadKPIs() {
  try {
    const res = await fetch(`/api/kpis${getQueryString()}`);
    const data = await res.json();

    document.getElementById('kpi-net-sales').textContent = formatCurrency(data.total_net_sales);
    document.getElementById('kpi-orders').textContent = formatNumber(data.total_orders);
    document.getElementById('kpi-customers').textContent = formatNumber(data.active_customers);
    document.getElementById('kpi-units').textContent = formatNumber(data.total_units_sold);
    document.getElementById('kpi-aov').textContent = formatCurrency(data.avg_order_value);
    document.getElementById('kpi-freight').textContent = formatCurrency(data.total_freight);
  } catch (err) {
    console.error('Error loading KPIs:', err);
  }
}

// 2. Monthly Trend Chart
async function loadMonthlyTrend() {
  try {
    const res = await fetch(`/api/sales/monthly${getQueryString()}`);
    const data = await res.json();

    const labels = data.map(d => d.month);
    const sales = data.map(d => d.net_sales);

    const ctx = document.getElementById('chart-monthly-sales').getContext('2d');
    if (monthlyChart) monthlyChart.destroy();

    monthlyChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Ventas Netas ($)',
          data: sales,
          borderColor: '#0284c7',
          backgroundColor: 'rgba(2, 132, 199, 0.08)',
          tension: 0.35,
          fill: true,
          pointBackgroundColor: '#0284c7',
          pointRadius: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: val => '$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val)
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error loading monthly sales:', err);
  }
}

// 3. Category Doughnut Chart
async function loadCategoryChart() {
  try {
    const res = await fetch(`/api/sales/by-category${getQueryString()}`);
    const data = await res.json();

    const labels = data.map(d => d.categoryname);
    const sales = data.map(d => d.net_sales);

    const colors = [
      '#0284c7', '#0ea5e9', '#38bdf8', '#7dd3fc',
      '#6366f1', '#818cf8', '#10b981', '#f59e0b'
    ];

    const ctx = document.getElementById('chart-category-pie').getContext('2d');
    if (categoryChart) categoryChart.destroy();

    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: sales,
          backgroundColor: colors.slice(0, labels.length)
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'right', labels: { boxWidth: 12, font: { size: 10 } } }
        }
      }
    });
  } catch (err) {
    console.error('Error loading category chart:', err);
  }
}

// 4. Country Chart
async function loadCountryChart() {
  try {
    const res = await fetch(`/api/sales/by-country${getQueryString()}`);
    const data = await res.json();

    const top10 = data.slice(0, 10);
    const labels = top10.map(d => d.country);
    const values = top10.map(d => d.net_sales);

    const ctx = document.getElementById('chart-countries').getContext('2d');
    if (countryChart) countryChart.destroy();

    countryChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Ventas Netas ($)',
          data: values,
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: val => '$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val)
            }
          }
        }
      }
    });
  } catch (err) {
    console.error('Error loading country chart:', err);
  }
}

// 5. Quick Top Products Table
async function loadQuickTopProducts() {
  try {
    const res = await fetch(`/api/products/top${getQueryString()}&limit=5`);
    const data = await res.json();

    const tbody = document.getElementById('quick-top-products-tbody');
    tbody.innerHTML = '';

    data.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2.5 font-medium text-slate-800">${p.productname}</td>
        <td class="py-2.5 text-slate-500">${p.categoryname}</td>
        <td class="py-2.5 text-right font-mono">${formatNumber(p.units_sold)}</td>
        <td class="py-2.5 text-right font-semibold text-slate-900">${formatCurrency(p.net_sales)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading quick products:', err);
  }
}

// 6. RFM Model View
async function loadRFMData() {
  try {
    const res = await fetch('/api/customers/rfm');
    const data = await res.json();
    allRfmCustomers = data.customers;

    // Render segment cards
    const container = document.getElementById('rfm-segments-container');
    container.innerHTML = '';

    const badgeColors = {
      'Campeones (VIP)': 'border-emerald-500 bg-emerald-50 text-emerald-800',
      'Clientes Leales': 'border-blue-500 bg-blue-50 text-blue-800',
      'Nuevos / Prometedores': 'border-sky-500 bg-sky-50 text-sky-800',
      'Necesitan Atención': 'border-amber-500 bg-amber-50 text-amber-800',
      'En Riesgo de Fuga': 'border-rose-500 bg-rose-50 text-rose-800',
      'En Hibernación / Perdidos': 'border-slate-400 bg-slate-50 text-slate-700',
      'Clientes Comunes': 'border-indigo-400 bg-indigo-50 text-indigo-700',
      'Inactivo / Sin Compras': 'border-gray-300 bg-gray-50 text-gray-500'
    };

    Object.keys(data.summary).forEach(seg => {
      const info = data.summary[seg];
      const card = document.createElement('div');
      const cls = badgeColors[seg] || 'border-slate-200 bg-white text-slate-800';
      card.className = `p-3.5 rounded-xl border-l-4 border shadow-xs ${cls}`;
      card.innerHTML = `
        <div class="text-[11px] font-semibold tracking-wide uppercase truncate" title="${seg}">${seg}</div>
        <div class="text-xl font-bold mt-1">${info.count} <span class="text-xs font-normal opacity-80">clientes</span></div>
        <div class="text-[10px] mt-1.5 space-y-0.5 opacity-90">
          <div>Facturación: <strong>${formatCurrency(info.total_monetary)}</strong></div>
          <div>Recencia Med: <strong>${info.avg_recency}d</strong> • Frec: <strong>${info.avg_frequency} ord</strong></div>
        </div>
      `;
      container.appendChild(card);
    });

    // Donut chart of customer counts per segment
    const segLabels = Object.keys(data.summary);
    const segCounts = segLabels.map(s => data.summary[s].count);
    const segRevenues = segLabels.map(s => data.summary[s].total_monetary);

    const donutCtx = document.getElementById('chart-rfm-donut').getContext('2d');
    if (rfmDonutChart) rfmDonutChart.destroy();
    rfmDonutChart = new Chart(donutCtx, {
      type: 'doughnut',
      data: {
        labels: segLabels,
        datasets: [{
          data: segCounts,
          backgroundColor: ['#10b981', '#3b82f6', '#06b6d4', '#f59e0b', '#f43f5e', '#64748b', '#8b5cf6', '#9ca3af']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 9 } } } }
      }
    });

    // Bar chart of revenues per segment
    const barCtx = document.getElementById('chart-rfm-revenue').getContext('2d');
    if (rfmRevenueChart) rfmRevenueChart.destroy();
    rfmRevenueChart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: segLabels,
        datasets: [{
          label: 'Facturación Total ($)',
          data: segRevenues,
          backgroundColor: '#0284c7',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { callback: val => '$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val) }
          }
        }
      }
    });

    renderRfmTable(allRfmCustomers);
  } catch (err) {
    console.error('Error loading RFM data:', err);
  }
}

function renderRfmTable(customers) {
  const tbody = document.getElementById('rfm-table-body');
  tbody.innerHTML = '';

  const pillStyle = {
    'Campeones (VIP)': 'bg-emerald-100 text-emerald-800',
    'Clientes Leales': 'bg-blue-100 text-blue-800',
    'Nuevos / Prometedores': 'bg-sky-100 text-sky-800',
    'Necesitan Atención': 'bg-amber-100 text-amber-800',
    'En Riesgo de Fuga': 'bg-rose-100 text-rose-800',
    'En Hibernación / Perdidos': 'bg-slate-200 text-slate-700',
    'Clientes Comunes': 'bg-indigo-100 text-indigo-800',
    'Inactivo / Sin Compras': 'bg-gray-100 text-gray-500'
  };

  customers.forEach(c => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-slate-50 transition';
    tr.innerHTML = `
      <td class="py-2 px-3 font-mono font-bold text-slate-700">${c.customerid}</td>
      <td class="py-2 px-3 font-medium text-slate-900">${c.companyname}</td>
      <td class="py-2 px-3 text-slate-500">${c.country}</td>
      <td class="py-2 px-3 text-right font-mono">${c.recency_days === 999 ? 'N/A' : c.recency_days + ' d'}</td>
      <td class="py-2 px-3 text-right font-mono">${c.frequency}</td>
      <td class="py-2 px-3 text-right font-mono font-semibold text-slate-800">${formatCurrency(c.monetary)}</td>
      <td class="py-2 px-3 text-center"><span class="font-mono bg-slate-100 px-2 py-0.5 rounded text-[11px] font-semibold">${c.rfm_score}</span></td>
      <td class="py-2 px-3"><span class="px-2.5 py-1 rounded-full text-[10px] font-medium ${pillStyle[c.segment] || 'bg-slate-100'}">${c.segment}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function filterRfmTable() {
  const term = document.getElementById('rfm-search').value.toLowerCase().trim();
  if (!term) {
    renderRfmTable(allRfmCustomers);
    return;
  }
  const filtered = allRfmCustomers.filter(c => 
    c.customerid.toLowerCase().includes(term) ||
    c.companyname.toLowerCase().includes(term) ||
    c.country.toLowerCase().includes(term) ||
    c.segment.toLowerCase().includes(term)
  );
  renderRfmTable(filtered);
}

// 7. Full Products Tab
async function loadProductsData() {
  try {
    const res = await fetch(`/api/products/top${getQueryString()}&limit=50`);
    const data = await res.json();

    // Chart top 10
    const top10 = data.slice(0, 10);
    const ctx = document.getElementById('chart-top-products-bar').getContext('2d');
    if (topProductsChart) topProductsChart.destroy();

    topProductsChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top10.map(p => p.productname.length > 18 ? p.productname.slice(0, 18) + '...' : p.productname),
        datasets: [{
          label: 'Venta Neta ($)',
          data: top10.map(p => p.net_sales),
          backgroundColor: '#0284c7',
          borderRadius: 4
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { callback: val => '$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val) } }
        }
      }
    });

    // Alert Box (low stock vs reorder level)
    const alertBox = document.getElementById('inventory-alert-box');
    alertBox.innerHTML = '';
    const reorderItems = data.filter(p => p.unitsinstock <= p.reorderlevel);

    if (reorderItems.length === 0) {
      alertBox.innerHTML = '<div class="text-xs text-emerald-600 p-3 bg-emerald-50 rounded-lg">Todos los niveles de inventario se encuentran por encima del umbral de reorden.</div>';
    } else {
      reorderItems.slice(0, 8).forEach(item => {
        const div = document.createElement('div');
        div.className = 'p-2.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 flex justify-between items-center text-xs';
        div.innerHTML = `
          <div>
            <div class="font-bold">${item.productname}</div>
            <div class="text-[10px] text-amber-700">Stock: ${item.unitsinstock} | Punto Reorden: ${item.reorderlevel}</div>
          </div>
          <span class="px-2 py-0.5 bg-amber-200 text-amber-900 rounded font-semibold text-[10px]">Reordenar</span>
        `;
        alertBox.appendChild(div);
      });
    }

    // Table
    const tbody = document.getElementById('products-table-body');
    tbody.innerHTML = '';
    data.forEach(p => {
      const tr = document.createElement('tr');
      tr.className = 'hover:bg-slate-50 transition';
      tr.innerHTML = `
        <td class="py-2 px-3 font-mono text-slate-500">${p.productid}</td>
        <td class="py-2 px-3 font-medium text-slate-900">${p.productname}</td>
        <td class="py-2 px-3 text-slate-500">${p.categoryname}</td>
        <td class="py-2 px-3 text-right font-mono">${formatCurrency(p.current_catalog_price)}</td>
        <td class="py-2 px-3 text-right font-mono ${p.unitsinstock <= p.reorderlevel ? 'text-amber-600 font-bold' : ''}">${p.unitsinstock}</td>
        <td class="py-2 px-3 text-right font-mono">${p.unitsonorder}</td>
        <td class="py-2 px-3 text-right font-mono">${p.reorderlevel}</td>
        <td class="py-2 px-3 text-right font-mono font-semibold">${formatNumber(p.units_sold)}</td>
        <td class="py-2 px-3 text-right font-mono font-bold text-slate-900">${formatCurrency(p.net_sales)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading products data:', err);
  }
}

// 8. Employees Tab
async function loadEmployeesData() {
  try {
    const res = await fetch(`/api/employees/performance${getQueryString()}`);
    const data = await res.json();

    const ctx = document.getElementById('chart-employees-bar').getContext('2d');
    if (employeesChart) employeesChart.destroy();

    employeesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.map(e => e.name),
        datasets: [{
          label: 'Ventas Netas ($)',
          data: data.map(e => e.net_sales),
          backgroundColor: '#6366f1',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { ticks: { callback: val => '$' + (val >= 1000 ? (val / 1000).toFixed(0) + 'k' : val) } }
        }
      }
    });

    // Org Hierarchy Box
    const orgBox = document.getElementById('org-hierarchy-box');
    orgBox.innerHTML = '';
    data.forEach(e => {
      const item = document.createElement('div');
      item.className = 'p-2 rounded-lg bg-slate-50 border border-slate-200 flex justify-between items-center';
      item.innerHTML = `
        <div>
          <div class="font-bold text-slate-800">${e.name}</div>
          <div class="text-[10px] text-slate-500">${e.title}</div>
        </div>
        <div class="text-[10px] text-right">
          <span class="text-slate-400">Reporta a:</span>
          <div class="font-medium text-slate-700">${e.manager || 'Dirección General'}</div>
        </div>
      `;
      orgBox.appendChild(item);
    });

    // Table
    const tbody = document.getElementById('employees-table-body');
    tbody.innerHTML = '';
    data.forEach(e => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2.5 px-3 font-mono text-slate-500">${e.employeeid}</td>
        <td class="py-2.5 px-3 font-medium text-slate-900">${e.name}</td>
        <td class="py-2.5 px-3 text-slate-500">${e.title}</td>
        <td class="py-2.5 px-3 text-slate-500">${e.manager || 'Dirección'}</td>
        <td class="py-2.5 px-3 text-right font-mono">${formatNumber(e.total_orders)}</td>
        <td class="py-2.5 px-3 text-right font-mono">${formatNumber(e.total_units)}</td>
        <td class="py-2.5 px-3 text-right font-mono">${formatCurrency(e.avg_order_ticket)}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-slate-900">${formatCurrency(e.net_sales)}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading employees:', err);
  }
}

// 9. Logistics Tab
async function loadLogisticsData() {
  try {
    const res = await fetch(`/api/logistics${getQueryString()}`);
    const data = await res.json();

    const labels = data.map(s => s.companyname);
    const shipments = data.map(s => s.total_shipments);
    const days = data.map(s => s.avg_delivery_days);

    // Volume Chart
    const volCtx = document.getElementById('chart-logistics-volume').getContext('2d');
    if (logisticsVolChart) logisticsVolChart.destroy();
    logisticsVolChart = new Chart(volCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Total Despachos',
          data: shipments,
          backgroundColor: '#0ea5e9',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } }
      }
    });

    // Delivery Days Chart
    const daysCtx = document.getElementById('chart-logistics-days').getContext('2d');
    if (logisticsDaysChart) logisticsDaysChart.destroy();
    logisticsDaysChart = new Chart(daysCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Días Promedio',
          data: days,
          backgroundColor: '#f59e0b',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

    // Table
    const tbody = document.getElementById('logistics-table-body');
    tbody.innerHTML = '';
    data.forEach(s => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2.5 px-3 font-mono text-slate-500">${s.shipperid}</td>
        <td class="py-2.5 px-3 font-medium text-slate-900">${s.companyname}</td>
        <td class="py-2.5 px-3 text-right font-mono">${formatNumber(s.total_shipments)}</td>
        <td class="py-2.5 px-3 text-right font-mono font-semibold">${formatCurrency(s.total_freight)}</td>
        <td class="py-2.5 px-3 text-right font-mono">${formatCurrency(s.avg_freight)}</td>
        <td class="py-2.5 px-3 text-right font-mono font-bold text-amber-700">${s.avg_delivery_days} d</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error loading logistics:', err);
  }
}

// 10. Audit Status Tab
async function fetchAuditStatus() {
  try {
    const res = await fetch('/api/audit');
    const data = await res.json();

    document.getElementById('audit-net-sales').textContent = formatCurrency(data.reconciliation.total_net_sales);
    document.getElementById('audit-total-qty').textContent = formatNumber(data.reconciliation.total_quantity);
    document.getElementById('audit-freight').textContent = formatCurrency(data.reconciliation.total_freight);
    document.getElementById('audit-fk').textContent = `${data.reconciliation.fk_violations} Violaciones`;

    const expectedCounts = {
      region: 4, territories: 53, categories: 8, suppliers: 29,
      customers: 91, employees: 9, employeeterritories: 49, shippers: 6,
      products: 77, orders: 830, order_details: 2155, usstates: 51
    };

    const tbody = document.getElementById('audit-counts-tbody');
    tbody.innerHTML = '';

    Object.keys(data.counts).forEach(tbl => {
      const exp = expectedCounts[tbl] || 0;
      const actual = data.counts[tbl];
      const match = exp === actual;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="py-2 px-3 font-mono font-medium text-slate-800">${tbl}</td>
        <td class="py-2 px-3 text-right font-mono text-slate-600">${formatNumber(exp)}</td>
        <td class="py-2 px-3 text-right font-mono font-bold text-slate-900">${formatNumber(actual)}</td>
        <td class="py-2 px-3 text-center">
          <span class="px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${match ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
            ${match ? '✓ Integridad 100%' : '⚠ Discrepancia'}
          </span>
        </td>
      `;
      tbody.appendChild(tr);
    });
  } catch (err) {
    console.error('Error fetching audit status:', err);
  }
}
