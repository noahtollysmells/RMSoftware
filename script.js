const staffUsers = { admin: { password: 'admin123', earnings: 0 } };
let tables = {}, archive = {}, companySessions = {}, loggedInUser = null, currentTable = null;

function save() {
  localStorage.setItem('mealApp', JSON.stringify({ staffUsers, tables, archive, companySessions, loggedInUser }));
}

function load() {
  const data = JSON.parse(localStorage.getItem('mealApp') || 'null');
  if (data) {
    Object.assign(staffUsers, data.staffUsers);
    tables = data.tables || {};
    archive = data.archive || {};
    companySessions = data.companySessions || {};
    loggedInUser = data.loggedInUser;
  }
  if (loggedInUser) staffLogin(true);
}
load();

function showPage(id) {
  ['loginPage','tableListPage','addTablePage','ordersPage'].forEach(el => document.getElementById(el).classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function staffLogin(reload = false) {
  const err = document.getElementById('loginError');
  if (!reload) {
    const u = document.getElementById('usernameInput').value.trim();
    const p = document.getElementById('passwordInput').value;
    if (!staffUsers[u] || staffUsers[u].password !== p) {
      err.innerText = 'Invalid credentials';
      err.style.display = 'block';
      return;
    }
    loggedInUser = u;
  } else {
    if (!loggedInUser) {
      showPage('loginPage');
      return;
    }
  }
  err.style.display = 'none';
  document.getElementById('staffNameDisplay').innerText = loggedInUser;
  updateTables();
  updateArchive();
  updateEarnings();
  updateAnalytics();
  save();
  showPage('tableListPage');
}

function createAdmin() {
  const u = document.getElementById('newAdminUser').value.trim();
  const p = document.getElementById('newAdminPass').value;
  if (!u || !p) return alert('Fill both new admin fields');
  if (staffUsers[u]) return alert('That username exists');
  staffUsers[u] = { password: p, earnings: 0 };
  alert(`Admin user ${u} created`);
  save();
}

function logout() {
  alert(`You earned £${staffUsers[loggedInUser].earnings.toFixed(2)} this session.`);
  loggedInUser = null;
  tables = {};
  archive = {};
  save();
  showPage('loginPage');
}

function clockOut() {
  const earned = staffUsers[loggedInUser].earnings;
  if (earned <= 0) return alert('No earnings to clock out');
  if (!confirm(`Clock out? You earned £${earned.toFixed(2)} this session.`)) return;
  const ts = new Date().toISOString();
  companySessions[ts] = { amount: earned, user: loggedInUser };
  staffUsers[loggedInUser].earnings = 0;
  updateEarnings();
  updateAnalytics();
  save();
}

function showAddTable() {
  document.getElementById('newTableNumber').value = '';
  document.getElementById('newTableName').value = '';
  showPage('addTablePage');
}

function goToTableList() {
  updateTables();
  updateArchive();
  showPage('tableListPage');
}

function addTable() {
  const num = document.getElementById('newTableNumber').value.trim();
  const nm = document.getElementById('newTableName').value.trim();
  if (!num || !nm) return alert('Fill both fields');
  tables[num] = { name: nm, orders: [], tip:0, payment:'', discount:'none', giftcard:0 };
  save();
  goToTableList();
}

function updateTables() {
  const c = document.getElementById('tablesContainer');
  c.innerHTML = tables && Object.keys(tables).length
    ? Object.keys(tables).map(t => 
        `<div class="list-item"><span onclick="openTable('${t}')">Table ${t} – ${tables[t].name}</span>
         <button class="cashout" onclick="cashOut('${t}')">Cash Out</button></div>`
      ).join('')
    : '<p>No open tables</p>';
}

function updateArchive() {
  const c = document.getElementById('archiveContainer');
  const html = archive && Object.keys(archive).length
    ? Object.keys(archive).map(t =>
        `<div class="list-item">Table ${t} – £${archive[t].total.toFixed(2)}</div>`
      ).join('')
    : '<p>No archived tables</p>';
  c.innerHTML = html;
}

function updateEarnings() {
  document.getElementById('earningsList').innerText = `${loggedInUser}: £${staffUsers[loggedInUser].earnings.toFixed(2)}`;
}

function updateAnalytics() {
  const c = document.getElementById('analyticsContainer');
  const keys = Object.keys(companySessions || {});
  if (keys.length === 0) {
    c.innerHTML = '<p>No sessions recorded</p>';
    return;
  }
  let total = 0;
  let out = keys.map(ts => {
    const session = companySessions[ts];
    total += session.amount;
    const d = new Date(ts).toLocaleString();
    return `<div class="list-item">${d} – £${session.amount.toFixed(2)} (by ${session.user})
            <button class="delete" onclick="deleteSession('${ts}')">Delete</button></div>`;
  }).join('');
  out = `<p><strong>Total earnings:</strong> £${total.toFixed(2)}</p>` + out;
  c.innerHTML = out;
}

function deleteSession(ts) {
  if (!confirm('Delete that session?')) return;
  delete companySessions[ts];
  updateAnalytics();
  save();
}

function openTable(t) {
  currentTable = t;
  const T = tables[t];
  document.getElementById('ordersTableTitle').innerText = `Table ${t} – ${T.name}`;
  document.getElementById('itemName').value = '';
  document.getElementById('itemPrice').value = '';
  document.getElementById('itemComment').value = '';
  document.getElementById('tipAmount').value = T.tip || '';
  document.getElementById('paymentMethod').value = T.payment || '';
  document.getElementById('discountType').value = T.discount || 'none';
  toggleGift();
  showPage('ordersPage');
}

function toggleGift() {
  document.getElementById('giftAmount').style.display =
    document.getElementById('discountType').value === 'giftcard' ? 'block' : 'none';
}

function addOrder() {
  const T = tables[currentTable];
  const cat = document.getElementById('itemCategory').value;
  const nameEl = document.getElementById('itemName');
  const priceEl = document.getElementById('itemPrice');
  const commentEl = document.getElementById('itemComment');

  const name = nameEl.value.trim();
  const price = parseFloat(priceEl.value);
  const comment = commentEl.value.trim();
  if (!name || isNaN(price) || price < 0)
    return alert('Enter valid item name and price');

  T.orders.push({ category: cat, name, price, comment });
  save();
  alert('Added');
  nameEl.value = '';
  priceEl.value = '';
  commentEl.value = '';
}

function viewReceipt() {
  const T = tables[currentTable];
  const tip = parseFloat(document.getElementById('tipAmount').value) || 0;
  const payment = document.getElementById('paymentMethod').value;
  const discountType = document.getElementById('discountType').value;
  const gift = parseFloat(document.getElementById('giftAmount').value) || 0;

  let sub = 0, meals = '', drinks = '';
  T.orders.forEach(o => {
    sub += o.price;
    const c = o.comment ? ` (${o.comment})` : '';
    const line = `<div>${o.category}: ${o.name} - £${o.price.toFixed(2)}${c}</div>`;
    if (o.category === 'Meal') meals += line; else drinks += line;
  });

  let discount = 0;
  if (discountType === 'student') discount = sub * 0.25;
  else if (discountType === 'giftcard') discount = gift;

  const total = sub - discount + tip;

  document.getElementById('receiptContainer').innerHTML = `
    <h3>Receipt · Table ${currentTable}</h3>
    Customer: ${T.name}<br />
    Payment: ${payment}<br />
    <h4>Meals</h4>${meals || '<p>—</p>'}
    <h4>Drinks</h4>${drinks || '<p>—</p>'}
    Subtotal: £${sub.toFixed(2)}<br />
    Discount: -£${discount.toFixed(2)}<br />
    Tip: £${tip.toFixed(2)}<br />
    <strong>Total: £${total.toFixed(2)}</strong>`;
  document.getElementById('receiptContainer').classList.remove('hidden');
  document.getElementById('printBtn').classList.remove('hidden');
  save();
}

function cashOut(tnum = currentTable) {
  viewReceipt();
  const tip = parseFloat(document.getElementById('tipAmount').value) || 0;
  const discountType = document.getElementById('discountType').value;
  const gift = parseFloat(document.getElementById('giftAmount').value) || 0;
  const T = tables[tnum];
  const sub = T.orders.reduce((a,o)=>a+o.price, 0);
  const discount = discountType==='student'?sub*0.25:discountType==='giftcard'?gift:0;
  const total = sub - discount + tip;
  if (!document.getElementById('paymentMethod').value) return alert('Select payment method');
  if (!confirm(`Cash out Table ${tnum} for £${total.toFixed(2)}?`)) return;
  staffUsers[loggedInUser].earnings += total;
  archive[tnum] = { total };
  delete tables[tnum];
  save();
  updateEarnings();
  updateTables();
  updateArchive();
  showPage('tableListPage');
}

function deleteTable() {
  if (!tables[currentTable]) return;
  delete tables[currentTable];
  save();
  updateTables();
  showPage('tableListPage');
}
