from flask import Flask, render_template, request, redirect, url_for, session, g
import sqlite3
from werkzeug.security import generate_password_hash, check_password_hash
import os

DATABASE = os.path.join(os.path.dirname(__file__), 'ecommerce.db')
app = Flask(__name__, template_folder='templates', static_folder='static')
app.secret_key = 'dev_secret'


def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db


def init_db():
    with app.app_context():
        db = get_db()
        db.executescript('''
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT);
        CREATE TABLE IF NOT EXISTS products (id INTEGER PRIMARY KEY, name TEXT, price REAL, stock INTEGER);
        ''')
        cur = db.execute('SELECT COUNT(*) as c FROM products')
        if cur.fetchone()['c'] == 0:
            db.executemany('INSERT INTO products (name,price,stock) VALUES (?,?,?)',
                           [('T-Shirt',19.99,10), ('Mug',9.99,25), ('Notebook',4.99,50)])
        db.commit()


@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db:
        db.close()


@app.route('/')
def index():
    db = get_db()
    products = db.execute('SELECT * FROM products').fetchall()
    return render_template('index.html', products=products)


@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        try:
            db.execute('INSERT INTO users (username,password) VALUES (?,?)',
                       (username, generate_password_hash(password)))
            db.commit()
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            return render_template('register.html', error='Username already taken')
    return render_template('register.html')


@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(url_for('index'))
        return render_template('login.html', error='Invalid credentials')
    return render_template('login.html')


@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))


@app.route('/add_to_cart', methods=['POST'])
def add_to_cart():
    pid = request.form.get('product_id')
    qty = int(request.form.get('quantity', 1))
    cart = session.get('cart', {})
    cart[pid] = cart.get(pid, 0) + qty
    session['cart'] = cart
    return redirect(url_for('cart'))


@app.route('/cart')
def cart():
    cart = session.get('cart', {})
    items = []
    total = 0.0
    if cart:
        db = get_db()
        for pid, qty in cart.items():
            prod = db.execute('SELECT * FROM products WHERE id = ?', (pid,)).fetchone()
            if prod:
                subtotal = prod['price'] * qty
                total += subtotal
                items.append({'id': prod['id'], 'name': prod['name'], 'price': prod['price'], 'qty': qty, 'subtotal': subtotal})
    return render_template('cart.html', items=items, total=total)


if __name__ == '__main__':
    init_db()
    app.run(debug=True)
