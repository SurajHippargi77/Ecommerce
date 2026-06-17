// Frontend logic wired to the FastAPI backend.
const API_BASE = 'http://127.0.0.1:8001';
const PRODUCT_FALLBACKS = [
  {id:1,name:'Midnight Alloy Wheels',price:15999,image:'https://commons.wikimedia.org/wiki/Special:FilePath/Ferrari_599_HY_KERS_wheel.jpg'},
  {id:2,name:'Carbon Grip Steering Cover',price:2499,image:'https://commons.wikimedia.org/wiki/Special:FilePath/Old_car_steering_wheel_(2662480818).jpg'},
  {id:3,name:'Amber LED Headlight Kit',price:6799,image:'https://commons.wikimedia.org/wiki/Special:FilePath/2007_GMC_Yukon_XL_Headlights.jpg'},
  {id:4,name:'Cruise Comfort Seat Cushions',price:3299,image:'https://commons.wikimedia.org/wiki/Special:FilePath/Interior_del_SEAT_Ibiza_IV_Restyling.JPG'},
  {id:5,name:'RoadGuard Car Vacuum Pro',price:4599,image:'https://commons.wikimedia.org/wiki/Special:FilePath/Automobile_vacuum,_Walkerville,_Windsor,_Ontario,_2025-09-01.jpg'},
  {id:6,name:'Velocity Dash Organizer',price:1899,image:'https://commons.wikimedia.org/wiki/Special:FilePath/Ursulines_Street_French_Quarter_Aug_2009_Jeep_Dashboard.JPG'}
];

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

function formatCurrency(value){
  return currencyFormatter.format(value);
}

function loadCurrentUser(){try{return JSON.parse(localStorage.getItem('ss_current'))||null;}catch(e){return null}}
function saveCurrentUser(user){localStorage.setItem('ss_current',JSON.stringify(user));}
function getUserId(){const currentUser=loadCurrentUser();return currentUser?.user_id || currentUser?.email || 'guest';}
function getCurrentUser(){return loadCurrentUser();}

function logout(){
  localStorage.removeItem('ss_current');
  renderAuthLinks();
  window.location.href = 'login.html';
}

function renderAuthLinks(){
  const nav = document.querySelector('header nav');
  if(!nav) return;
  const current = loadCurrentUser();
  nav.innerHTML = '';
  const makeLink = (href, text, id) => { const a = document.createElement('a'); a.href = href; a.textContent = text; if(id) a.id = id; return a };
  nav.appendChild(makeLink('index.html','Home'));
  const cartLink = document.createElement('a'); cartLink.href = 'cart.html'; cartLink.id = 'nav-cart'; cartLink.innerHTML = 'Cart (<span id="cart-count">0</span>)'; nav.appendChild(cartLink);
  if(current){
    // profile avatar link
    const profileA = document.createElement('a');
    profileA.href = 'profile.html';
    profileA.id = 'nav-profile';
    profileA.className = 'nav-avatar';
    profileA.title = current.name || current.email || 'Profile';
    // inline user icon (SVG)
    profileA.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M12 12c2.761 0 5-2.239 5-5s-2.239-5-5-5-5 2.239-5 5 2.239 5 5 5z" fill="#ffd56a" opacity="0.95"/><path d="M12 14c-4.418 0-8 1.79-8 4v2h16v-2c0-2.21-3.582-4-8-4z" fill="#fff" opacity="0.06"/></svg>`;
    nav.appendChild(profileA);
    const logoutA = makeLink('#','Logout','nav-logout'); logoutA.addEventListener('click', e=>{e.preventDefault(); logout()}); nav.appendChild(logoutA);
  }else{
    nav.appendChild(makeLink('login.html','Login','nav-login'));
    nav.appendChild(makeLink('register.html','Register','nav-register'));
  }
}

async function apiRequest(path, options={}){
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  if(!response.ok){
    let message = `Request failed (${response.status})`;
    try{
      const body = await response.json();
      message = body.detail || message;
    }catch(e){}
    throw new Error(message);
  }
  if(response.status === 204){
    return null;
  }
  return response.json();
}

async function getProducts(){
  try{
    return await apiRequest('/products');
  }catch(e){
    console.warn('Using local product fallback:', e);
    return PRODUCT_FALLBACKS;
  }
}

function updateCartCount(){
  const el=document.getElementById('cart-count');
  if(!el)return;
  apiRequest(`/cart/${encodeURIComponent(getUserId())}`)
    .then(cart=>{el.textContent=(cart.items||[]).reduce((sum,item)=>sum+Number(item.quantity||0),0)})
    .catch(()=>{el.textContent='0'})
}

async function renderProducts(){
  const container=document.getElementById('products');
  if(!container)return;
  const products = await getProducts();
  container.innerHTML='';
  products.forEach(p=>{
    const card=document.createElement('div');
    card.className='card product-card';
    card.innerHTML=`<img src="${p.image_url || p.image || ''}" alt="${p.name}" loading="lazy"><div class="product-badge">Car Gear</div><h3>${p.name}</h3><div class="product-meta"><strong>${formatCurrency(p.price)}</strong><button class="btn" data-id="${p.id}">Add</button></div>`;
    container.appendChild(card)
  });
  container.querySelectorAll('button[data-id]').forEach(btn=>btn.addEventListener('click',async e=>{const id=Number(e.target.dataset.id);await addToCart(id)}))
}

async function addToCart(id){
  try{
    await apiRequest(`/cart/${encodeURIComponent(getUserId())}/items`, {
      method:'POST',
      body: JSON.stringify({product_id:id, quantity:1})
    });
    updateCartCount();
    alert('Added to cart');
  }catch(e){
    alert(e.message);
  }
}

async function renderCart(){
  const container=document.getElementById('cart-items');
  const summary=document.getElementById('cart-summary');
  if(!container||!summary)return;
  try{
    const cart = await apiRequest(`/cart/${encodeURIComponent(getUserId())}`);
    if(!cart.items || cart.items.length===0){
      container.innerHTML='<p>Your cart is empty.</p>';
      summary.innerHTML='';
      return;
    }
    container.innerHTML='';
    cart.items.forEach(item=>{
      const row=document.createElement('div');
      row.className='card';
      row.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;gap:1rem"><div><strong>${item.name}</strong><div class="muted">${formatCurrency(item.price)} x ${item.quantity}</div></div><div><button class="btn small" data-decr="${item.id}">-</button> <button class="btn small" data-incr="${item.id}">+</button> <button class="muted" data-rem="${item.id}">Remove</button></div></div>`;
      container.appendChild(row)
    });
    container.querySelectorAll('[data-incr]').forEach(b=>b.addEventListener('click',async e=>{await changeQty(Number(e.target.dataset.incr),1);await renderCart();updateCartCount()}))
    container.querySelectorAll('[data-decr]').forEach(b=>b.addEventListener('click',async e=>{await changeQty(Number(e.target.dataset.decr),-1);await renderCart();updateCartCount()}))
    container.querySelectorAll('[data-rem]').forEach(b=>b.addEventListener('click',async e=>{await removeItem(Number(e.target.dataset.rem));await renderCart();updateCartCount()}))
    summary.innerHTML=`<div class="card"><h3>Summary</h3><p>Total: ${formatCurrency(cart.total || 0)}</p><button class="btn" id="clear-cart">Clear Cart</button></div>`;
    const clear=document.getElementById('clear-cart');
    if(clear)clear.addEventListener('click',async ()=>{await clearCart();await renderCart();updateCartCount()})
  }catch(e){
    container.innerHTML=`<p>${e.message}</p>`;
    summary.innerHTML='';
  }
}

async function changeQty(id,delta){
  const cart = await apiRequest(`/cart/${encodeURIComponent(getUserId())}`);
  const item = (cart.items || []).find(entry=>Number(entry.id)===Number(id));
  if(!item)return;
  const nextQty = item.quantity + delta;
  if(nextQty < 1){
    await removeItem(id);
    return;
  }
  await apiRequest(`/cart/${encodeURIComponent(getUserId())}/items/${encodeURIComponent(String(id))}`, {
    method:'PATCH',
    body: JSON.stringify({quantity: nextQty})
  });
}

async function removeItem(id){
  await apiRequest(`/cart/${encodeURIComponent(getUserId())}/items/${encodeURIComponent(String(id))}`, {
    method:'DELETE'
  });
}

async function clearCart(){
  const cart = await apiRequest(`/cart/${encodeURIComponent(getUserId())}`);
  await Promise.all((cart.items || []).map(item=>apiRequest(`/cart/${encodeURIComponent(getUserId())}/items/${encodeURIComponent(String(item.id))}`, {method:'DELETE'})));
}

async function checkoutCart(){
  const current = getCurrentUser();
  if(!current){
    throw new Error('Please log in first');
  }
  const paymentMethod = document.getElementById('payment-method')?.value || 'cod';
  const address = document.getElementById('delivery-address')?.value || '';
  return apiRequest(`/checkout/${encodeURIComponent(getUserId())}`, {
    method:'POST',
    body: JSON.stringify({ payment_method: paymentMethod, address })
  });
}

async function registerUser(name,email,password){
  return apiRequest('/auth/register', { method:'POST', body: JSON.stringify({full_name:name,email,password}) });
}

async function loginUser(email,password){
  return apiRequest('/auth/login', { method:'POST', body: JSON.stringify({email,password}) });
}

// page-specific wiring
function initializePage(){
  // render auth-aware navigation first
  renderAuthLinks();
  updateCartCount();
  renderProducts();

  // login page
  const loginForm=document.getElementById('login-form');
  if(loginForm){
    loginForm.addEventListener('submit',async e=>{
      e.preventDefault();
      const email=document.getElementById('login-email').value;
      const pw=document.getElementById('login-password').value;
      try{
        const r=await loginUser(email,pw);
        saveCurrentUser({email:r.email||email,name:r.name||email, access_token:r.access_token, refresh_token:r.refresh_token, user_id: r.user_id});
        renderAuthLinks();
        alert('Welcome '+(r.email||email));
        window.location.href='index.html';
      }catch(err){
        alert(err.message);
      }
    });
  }

  // register page
  const regForm=document.getElementById('register-form');
  if(regForm){
    regForm.addEventListener('submit',async e=>{
      e.preventDefault();
      const name=document.getElementById('reg-name').value;
      const email=document.getElementById('reg-email').value;
      const pw=document.getElementById('reg-password').value;
      try{
        const r = await registerUser(name,email,pw);
        // register may return user_id and email
        saveCurrentUser({email: r.email || email, name, user_id: r.user_id || null});
        renderAuthLinks();
        alert('Registered — you can now login');
        window.location.href='login.html';
      }catch(err){
        alert(err.message);
      }
    });
  }

  // cart page
  if(document.getElementById('cart-items')){
    renderCart();
    const checkoutBtn = document.getElementById('checkout-btn');
    if(checkoutBtn){
      checkoutBtn.addEventListener('click', async ()=>{
        try{
          const order = await checkoutCart();
          alert(`Order placed: ${order.id} (${order.payment_method})`);
          await renderCart();
          updateCartCount();
          window.location.href = 'profile.html';
        }catch(err){
          alert(err.message);
        }
      });
    }
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',initializePage);
}else{
  initializePage();
}
