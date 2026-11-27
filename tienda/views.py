import base64
from collections import Counter, defaultdict
from datetime import datetime
from functools import wraps
import io
import json
import os
import random
import re
import uuid
import shutil

from bson import ObjectId
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.hashers import check_password, make_password
from django.core.mail import send_mail
from django.core.paginator import Paginator
from django.http import HttpResponse, JsonResponse
from django.shortcuts import redirect, render
from django.templatetags.static import static
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt
from google.auth.transport import requests
from google.oauth2 import id_token
import qrcode

from db_mongo import db

GOOGLE_CLIENT_ID = "382398764900-6otetq3jppn56hgb7ugc2amuctudt89a.apps.googleusercontent.com"

ENVIO_GRATIS_MINIMO = 1299.0
COSTO_ENVIO_ESTANDAR = 149.0


def requiere_rol(roles_permitidos=['admin', 'superadmin']):
    """Decorador para proteger rutas restringidas según el rol guardado en MongoDB."""
    def decorator(view_func):
        @wraps(view_func)
        def _wrapped_view(request, *args, **kwargs):
            usuario_email = request.session.get('usuario_email')
            if not usuario_email:
                messages.error(request, "Debes iniciar sesión para acceder al panel de administración.")
                return redirect('login')

            usuario = db.usuarios.find_one({'email': usuario_email})
            rol_usuario = usuario.get('rol', 'cliente') if usuario else 'cliente'

            if rol_usuario not in roles_permitidos:
                messages.error(request, "Acceso denegado: No tienes permisos suficientes.")
                return redirect('inicio')

            return view_func(request, *args, **kwargs)
        return _wrapped_view
    return decorator


def obtener_folio_pedido(pedido):
    """Devuelve el folio único del pedido o genera uno compatible para pedidos antiguos."""
    if pedido.get('folio'):
        return pedido['folio']
    return f"VRT-{str(pedido['_id'])[-6:].upper()}"


def normalizar_url_imagen(valor):
    """Convierte rutas locales (static/media/...) en URLs válidas para el navegador."""
    if not valor:
        return ''
    ruta = str(valor).strip()

    match_tag = re.match(r"^\{%\s*static\s+['\"]([^'\"]+)['\"]\s*%\}$", ruta)
    if match_tag:
        ruta = match_tag.group(1).strip()

    if ruta.startswith(('http://', 'https://', 'data:', '/static/')):
        return ruta

    if ruta.startswith('static/'):
        ruta = ruta[len('static/'):]
    elif '/' not in ruta:
        ruta = f'media/{ruta}'

    return static(ruta)


def guardar_imagen_subida(archivo):
    """Guarda un archivo de imagen subido en static/media/ y devuelve la ruta relativa."""
    if not archivo:
        return ''

    nombre_limpio = re.sub(r'[^a-zA-Z0-9._-]', '_', archivo.name)
    nombre_final = f"{uuid.uuid4().hex[:8]}_{nombre_limpio}"
    carpeta_destino = os.path.join(settings.BASE_DIR, 'static', 'media')
    os.makedirs(carpeta_destino, exist_ok=True)

    ruta_completa = os.path.join(carpeta_destino, nombre_final)
    with open(ruta_completa, 'wb+') as destino:
        for chunk in archivo.chunks():
            destino.write(chunk)

    return f"media/{nombre_final}"


def paginar_lista(request, lista_elementos, por_pagina=16, param_pagina='page'):
    """Pagina cualquier lista de MongoDB manteniendo el número de página limpio."""
    paginator = Paginator(lista_elementos, por_pagina)
    numero_pagina = request.GET.get(param_pagina, 1)
    return paginator.get_page(numero_pagina)


def login_view(request):
    if 'usuario_email' in request.session:
        rol_sesion = request.session.get('usuario_rol', 'cliente')
        if rol_sesion in ['admin', 'superadmin']:
            return redirect('admin_dashboard')
        return redirect('inicio')

    error = None
    paso = request.POST.get('paso', '1')

    if request.method == 'POST':

        if paso == '1':
            email = request.POST.get('email', '').strip().lower()
            password = request.POST.get('password', '')

            patron_email = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
            if not re.match(patron_email, email):
                error = "Ingresa un correo válido con formato usuario@dominio.com"
                return render(request, 'login.html', {'error': error, 'email': email, 'paso': 1})

            try:
                usuario_existente = db.usuarios.find_one({'email': email})
            except Exception as mongo_err:
                print("--> ERROR MONGO DB:", mongo_err)
                error = "Error al conectar con MongoDB. Asegúrate de que el servicio de MongoDB esté activo."
                return render(request, 'login.html', {'error': error, 'email': email, 'paso': 1})

            if usuario_existente:
                password_guardada = usuario_existente.get('password', '')

                if check_password(password, password_guardada):
                    rol_usuario = usuario_existente.get('rol', 'cliente')

                    request.session.flush()
                    request.session['usuario_email'] = usuario_existente.get('email')
                    request.session['usuario_nombre'] = usuario_existente.get('nombre', 'Usuario')
                    request.session['usuario_rol'] = rol_usuario
                    request.session.modified = True

                    nombre = usuario_existente.get('nombre', '')
                    messages.success(request, f'¡Bienvenido de nuevo, {nombre}!' if nombre else '¡Sesión iniciada con éxito!')

                    if rol_usuario in ['admin', 'superadmin']:
                        return redirect('admin_dashboard')

                    return redirect('inicio')
                else:
                    error = "La contraseña ingresada es incorrecta."
                    return render(request, 'login.html', {'error': error, 'email': email, 'paso': 1})

            else:
                if len(password) < 8:
                    error = "La contraseña debe tener al menos 8 caracteres."
                    return render(request, 'login.html', {'error': error, 'email': email, 'paso': 1})
                if not re.search(r'[A-Z]', password):
                    error = "La contraseña debe tener al menos una mayúscula."
                    return render(request, 'login.html', {'error': error, 'email': email, 'paso': 1})
                if not re.search(r'[a-z]', password):
                    error = "La contraseña debe tener al menos una minúscula."
                    return render(request, 'login.html', {'error': error, 'email': email, 'paso': 1})
                if not re.search(r'[0-9]', password):
                    error = "La contraseña debe contener números."
                    return render(request, 'login.html', {'error': error, 'email': email, 'paso': 1})
                if not re.search(r'[!@#$%&*()_+\-=\/{};:\'",.<>/\\]', password):
                    error = "La contraseña debe tener al menos un carácter especial."
                    return render(request, 'login.html', {'error': error, 'email': email, 'paso': 1})

                codigo_otp = str(random.randint(100000, 999999))

                try:
                    send_mail(
                        subject='Código de verificación - Vértice',
                        message=f'Tu código de confirmación para crear tu cuenta es: {codigo_otp}',
                        from_email='dan.are.nez.24@gmail.com',
                        recipient_list=[email],
                        fail_silently=False,
                    )

                    request.session['temp_email'] = email
                    request.session['temp_password'] = password
                    request.session['codigo_otp'] = str(codigo_otp)
                    request.session.modified = True
                    request.session.set_expiry(0)

                    return render(request, 'login.html', {'paso': 2, 'email': email})

                except Exception as e:
                    print("Error al enviar correo:", e)
                    error = "No se pudo enviar el correo de verificación. Revisa la configuración de envío de correo."
                    return render(request, 'login.html', {'error': error, 'email': email, 'paso': 1})

        elif paso == '2':
            codigo_ingresado = str(request.POST.get('codigo', '')).strip()
            codigo_guardado = str(request.session.get('codigo_otp', '')).strip()
            email = request.POST.get('email', '').strip() or request.session.get('temp_email')

            if codigo_ingresado and codigo_guardado and codigo_ingresado == codigo_guardado:
                return render(request, 'login.html', {'paso': 3, 'email': email})
            else:
                if not codigo_guardado:
                    error = "La sesión expiró o se perdió el código OTP. Por favor intenta registrarte de nuevo."
                else:
                    error = "El código de verificación es incorrecto. Inténtalo de nuevo."

                return render(request, 'login.html', {'error': error, 'paso': 2, 'email': email})

        elif paso == '3':
            nombre = request.POST.get('nombre', '').strip()
            apellidos = request.POST.get('apellidos', '').strip()
            email = request.session.get('temp_email') or request.POST.get('email', '').strip()
            password = request.session.get('temp_password')

            if email and password and nombre and apellidos:
                password_encriptada = make_password(password)

                try:
                    db.usuarios.insert_one({
                        'email': email,
                        'password': password_encriptada,
                        'nombre': nombre,
                        'apellidos': apellidos,
                        'rol': 'cliente',
                        'fecha_registro': datetime.utcnow()
                    })
                except Exception as mongo_err:
                    print("--> ERROR AL INSERTAR USUARIO EN MONGO:", mongo_err)
                    error = "Error al guardar el usuario en la base de datos."
                    return render(request, 'login.html', {'paso': 3, 'email': email, 'error': error})

                request.session.flush()
                request.session['usuario_email'] = email
                request.session['usuario_nombre'] = nombre
                request.session['usuario_rol'] = 'cliente'
                request.session.modified = True

                messages.success(request, f'¡Bienvenido {nombre}! Tu cuenta se ha registrado con éxito.')
                return redirect('inicio')
            else:
                error = "Por favor completa todos los campos."
                return render(request, 'login.html', {
                    'paso': 3,
                    'email': email,
                    'error': error
                })

    return render(request, 'login.html', {'paso': 1})


@csrf_exempt
def google_login_view(request):
    """Procesa el inicio de sesión con Google (soporta redirección directa GIS y JSON)."""
    if request.method == 'POST':
        try:
            es_json = 'application/json' in (request.content_type or '')
            data = json.loads(request.body) if es_json else request.POST

            token = data.get('credential')
            email = None
            nombre = ''
            apellidos = ''

            if token:
                try:
                    idinfo = id_token.verify_oauth2_token(
                        token,
                        requests.Request(),
                        GOOGLE_CLIENT_ID,
                        clock_skew_in_seconds=10
                    )
                    email = (idinfo.get('email') or '').strip().lower()
                    nombre = idinfo.get('given_name', '') or idinfo.get('name', '')
                    apellidos = idinfo.get('family_name', '')
                except Exception as token_err:
                    print("--> ERROR TOKEN GOOGLE:", token_err)
                    if es_json:
                        return JsonResponse({'status': 'error', 'message': f'Token JWT inválido: {str(token_err)}'}, status=400)
                    messages.error(request, 'No se pudo validar la sesión con Google. Inténtalo de nuevo.')
                    return redirect('login')
            else:
                email = (data.get('email') or '').strip().lower()
                nombre = data.get('given_name', '') or data.get('name', '')
                apellidos = data.get('family_name', '')

            if not email:
                if es_json:
                    return JsonResponse({'status': 'error', 'message': 'No se recibió un correo de Google.'}, status=400)
                messages.error(request, 'Google no proporcionó un correo electrónico.')
                return redirect('login')

            try:
                usuario = db.usuarios.find_one({'email': email})

                if not usuario:
                    usuario_data = {
                        'email': email,
                        'nombre': nombre or 'Usuario',
                        'apellidos': apellidos,
                        'rol': 'cliente',
                        'metodo_registro': 'google_web',
                        'fecha_registro': datetime.utcnow(),
                        'ultimo_login': datetime.utcnow()
                    }
                    db.usuarios.insert_one(usuario_data)
                    rol_usuario = 'cliente'
                else:
                    rol_usuario = usuario.get('rol', 'cliente')
                    db.usuarios.update_one(
                        {'email': email},
                        {'$set': {
                            'nombre': nombre or usuario.get('nombre', ''),
                            'apellidos': apellidos or usuario.get('apellidos', ''),
                            'ultimo_login': datetime.utcnow()
                        }}
                    )
            except Exception as mongo_err:
                print("--> ERROR DE CONEXIÓN A MONGO DB:", mongo_err)
                if es_json:
                    return JsonResponse({'status': 'error', 'message': 'Error al conectar con MongoDB.'}, status=500)
                messages.error(request, 'Error al guardar tu cuenta en la base de datos.')
                return redirect('login')

            request.session.flush()
            request.session['usuario_email'] = email
            request.session['usuario_nombre'] = nombre or 'Usuario'
            request.session['usuario_rol'] = rol_usuario
            request.session.modified = True
            request.session.set_expiry(0)

            messages.success(request, f'¡Bienvenido {nombre}!' if nombre else '¡Sesión iniciada con éxito!')

            destino = 'admin_dashboard' if rol_usuario in ['admin', 'superadmin'] else 'inicio'
            if es_json:
                return JsonResponse({'status': 'ok', 'redirect_url': reverse(destino)})
            return redirect(destino)

        except Exception as e:
            print("--> ERROR GENERAL GOOGLE LOGIN:", e)
            messages.error(request, 'Ocurrió un error inesperado al iniciar sesión con Google.')
            return redirect('login')

    return redirect('login')


def logout_view(request):
    request.session.flush()
    return redirect('login')


# ==============================================================================
# RUTAS DE LOGIN POR CÓDIGO QR
# ==============================================================================

def generar_qr_login(request):
    token_sesion = str(uuid.uuid4())

    db.tokens_qr.insert_one({
        'token': token_sesion,
        'estado': 'pendiente',
        'usuario': None,
        'fecha': datetime.utcnow()
    })

    url_escaneo = request.build_absolute_uri(f'/scan-qr/{token_sesion}/')

    qr = qrcode.QRCode(box_size=8, border=2)
    qr.add_data(url_escaneo)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")

    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')

    return JsonResponse({
        'status': 'success',
        'token': token_sesion,
        'qr_image': qr_base64
    })


def verificar_estado_qr(request, token):
    registro = db.tokens_qr.find_one({'token': token})

    if registro and registro.get('estado') == 'aprobado':
        usuario = registro.get('usuario') or {}
        usuario_db = db.usuarios.find_one({'email': usuario.get('email')}) or {}
        rol_usuario = usuario_db.get('rol', 'cliente')

        request.session['usuario_email'] = usuario.get('email')
        request.session['usuario_nombre'] = usuario.get('nombre')
        request.session['usuario_rol'] = rol_usuario
        request.session.modified = True
        request.session.set_expiry(0)

        db.tokens_qr.delete_one({'token': token})

        redirect_url = '/admin-panel/' if rol_usuario in ['admin', 'superadmin'] else '/'
        return JsonResponse({'status': 'exito', 'redirect_url': redirect_url})

    return JsonResponse({'status': 'pendiente'})


def pagina_escaneo_qr(request, token):
    registro = db.tokens_qr.find_one({'token': token})

    if not registro or registro.get('estado') != 'pendiente':
        return render(request, 'scan_mobile.html', {'error': 'Este código QR ha expirado o ya fue utilizado.'})

    return render(request, 'scan_mobile.html', {
        'token': token,
        'google_client_id': GOOGLE_CLIENT_ID
    })


def aprobar_login_qr(request):
    if request.method == 'POST':
        data = json.loads(request.body)
        token_qr = data.get('token_qr')
        google_jwt = data.get('google_jwt')

        try:
            idinfo = id_token.verify_oauth2_token(google_jwt, requests.Request(), GOOGLE_CLIENT_ID)

            email = idinfo.get('email')
            nombre = idinfo.get('given_name', '')
            apellidos = idinfo.get('family_name', '')

            usuario = db.usuarios.find_one({'email': email})

            if not usuario:
                usuario_data = {
                    'email': email,
                    'nombre': nombre,
                    'apellidos': apellidos,
                    'rol': 'cliente',
                    'metodo_registro': 'qr_google',
                    'fecha_registro': datetime.utcnow()
                }
                db.usuarios.insert_one(usuario_data)

            db.tokens_qr.update_one(
                {'token': token_qr},
                {'$set': {
                    'estado': 'aprobado',
                    'usuario': {
                        'email': email,
                        'nombre': nombre,
                        'apellidos': apellidos
                    }
                }}
            )

            return JsonResponse({'status': 'ok'})

        except Exception as e:
            return JsonResponse({'status': 'error', 'message': str(e)}, status=400)

    return JsonResponse({'status': 'invalid_method'}, status=405)


# ==============================================================================
# SECCIONES DEL CATÁLOGO DE PRODUCTOS DE MODA (PAGINADAS DE 16 EN 16)
# ==============================================================================

def obtener_productos_por_filtro(filtro):
    """Función auxiliar para obtener prendas, normalizar imágenes y calcular disponibilidad."""
    productos = list(db.Productos.find(filtro))
    for p in productos:
        p['id_str'] = str(p['_id'])
        img = normalizar_url_imagen(p.get('imagen_url') or p.get('imagen', ''))
        p['imagen_url'] = img
        p['imagen'] = img
        stock_disp = obtener_stock_disponible(p)
        p['agotado'] = (stock_disp is not None and stock_disp <= 0)
    return productos


def inicio(request):
    query = request.GET.get('q', '').strip()

    if query:
        regex_query = re.compile(re.escape(query), re.IGNORECASE)
        filtro = {
            '$or': [
                {'nombre': {'$regex': regex_query}},
                {'categoria': {'$regex': regex_query}},
                {'descripcion': {'$regex': regex_query}}
            ]
        }
        productos_todos = obtener_productos_por_filtro(filtro)
    else:
        productos_todos = obtener_productos_por_filtro({})

    productos = paginar_lista(request, productos_todos, por_pagina=16)

    return render(request, 'index.html', {
        'productos': productos,
        'query': query
    })


def seccion_el(request):
    query = request.GET.get('q', '').strip()
    filtro = {'categoria': 'el'}

    if query:
        regex_query = re.compile(re.escape(query), re.IGNORECASE)
        filtro['$or'] = [
            {'nombre': {'$regex': regex_query}},
            {'descripcion': {'$regex': regex_query}},
            {'coleccion': {'$regex': regex_query}}
        ]

    productos = paginar_lista(request, obtener_productos_por_filtro(filtro), por_pagina=16)
    return render(request, 'el.html', {
        'productos': productos,
        'query': query
    })


def seccion_ella(request):
    query = request.GET.get('q', '').strip()
    filtro = {'categoria': 'ella'}

    if query:
        regex_query = re.compile(re.escape(query), re.IGNORECASE)
        filtro['$or'] = [
            {'nombre': {'$regex': regex_query}},
            {'descripcion': {'$regex': regex_query}},
            {'coleccion': {'$regex': regex_query}}
        ]

    productos = paginar_lista(request, obtener_productos_por_filtro(filtro), por_pagina=16)
    return render(request, 'ella.html', {
        'productos': productos,
        'query': query
    })


def seccion_niños(request):
    query = request.GET.get('q', '').strip()
    filtro = {'categoria': 'niños'}

    if query:
        regex_query = re.compile(re.escape(query), re.IGNORECASE)
        filtro['$or'] = [
            {'nombre': {'$regex': regex_query}},
            {'descripcion': {'$regex': regex_query}},
            {'coleccion': {'$regex': regex_query}}
        ]

    productos = paginar_lista(request, obtener_productos_por_filtro(filtro), por_pagina=16)
    return render(request, 'niños.html', {
        'productos': productos,
        'query': query
    })


def seccion_fin_año(request):
    query = request.GET.get('q', '').strip()
    filtro = {'coleccion': 'fin_año'}

    if query:
        regex_query = re.compile(re.escape(query), re.IGNORECASE)
        filtro['$or'] = [
            {'nombre': {'$regex': regex_query}},
            {'descripcion': {'$regex': regex_query}},
            {'coleccion': {'$regex': regex_query}}
        ]

    productos = paginar_lista(request, obtener_productos_por_filtro(filtro), por_pagina=16)
    return render(request, 'fin_año.html', {
        'productos': productos,
        'query': query
    })


def seccion_crear(request):
    return render(request, 'crear.html')


def seccion_google(request):
    return render(request, 'google.html')


def seccion_politica_de_uso(request):
    return render(request, 'politica_de_uso.html')


def seccion_politica_privacidad(request):
    return render(request, 'politica_privacidad.html')


def obtener_completa_el_look(coleccion_productos, producto_actual):
    """
    Busca 2 prendas complementarias de la misma sección/categoría
    que tengan stock disponible y normaliza sus imágenes y tallas.
    """
    try:
        prod_id = producto_actual.get('_id')
        categoria = producto_actual.get('categoria', '')
        subcategoria = producto_actual.get('subcategoria', '')

        filtro = {'_id': {'$ne': prod_id}}
        if categoria:
            filtro['categoria'] = categoria
        if subcategoria:
            filtro['subcategoria'] = {'$ne': subcategoria}

        candidatos_raw = list(coleccion_productos.find(filtro).limit(16))

        if len(candidatos_raw) < 2 and categoria:
            candidatos_raw = list(coleccion_productos.find({
                '_id': {'$ne': prod_id},
                'categoria': categoria
            }).limit(16))

        disponibles = []
        for item in candidatos_raw:
            disp = obtener_stock_disponible(item)
            if disp is None or disp > 0:
                disponibles.append(item)

        sugeridos = random.sample(disponibles, min(2, len(disponibles)))

        resultado = []
        for item in sugeridos:
            tallas_raw = item.get('tallas') or ['S', 'M', 'L', 'XL']
            tallas_disp = [
                t for t in tallas_raw
                if (obtener_stock_disponible(item, t) is None or obtener_stock_disponible(item, t) > 0)
            ]
            resultado.append({
                'id': str(item['_id']),
                'nombre': item.get('nombre', ''),
                'precio': float(item.get('precio', 0)),
                'imagen': normalizar_url_imagen(item.get('imagen_url') or item.get('imagen', '')),
                'tallas': tallas_disp or ['S', 'M', 'L'],
                'subcategoria': item.get('subcategoria') or item.get('coleccion') or 'COMPLEMENTO'
            })
        return resultado
    except Exception as e:
        print("--> Error en obtener_completa_el_look:", e)
        return []


def detalle_producto_view(request, producto_id):
    """Carga los detalles de una prenda con validación de stock por talla, favoritos y Completa el Look."""
    try:
        clean_id = str(producto_id).strip()
        producto = None

        if ObjectId.is_valid(clean_id):
            producto = db.Productos.find_one({'_id': ObjectId(clean_id)})

        if not producto:
            producto = db.Productos.find_one({'_id': clean_id})

        if not producto:
            messages.error(request, 'El producto solicitado no fue encontrado.')
            return redirect('inicio')

        id_str = str(producto['_id'])
        producto['id_str'] = id_str
        img = normalizar_url_imagen(producto.get('imagen_url') or producto.get('imagen', ''))
        producto['imagen_url'] = img
        producto['imagen'] = img

        tallas_lista = producto.get('tallas') or ['S', 'M', 'L', 'XL']
        stock_total = obtener_stock_disponible(producto)
        producto['agotado'] = (stock_total is not None and stock_total <= 0)
        producto['stock_total'] = stock_total

        tallas_detalle = []
        primera_disponible = None
        stock_inicial = 10

        for talla in tallas_lista:
            disp = obtener_stock_disponible(producto, talla)
            sin_stock = (disp is not None and disp <= 0)
            if not sin_stock and primera_disponible is None:
                primera_disponible = talla
                stock_inicial = disp if disp is not None else 10
            tallas_detalle.append({
                'nombre': talla,
                'stock': disp,
                'agotada': sin_stock
            })

        if primera_disponible is None and tallas_detalle:
            primera_disponible = tallas_detalle[0]['nombre']
            stock_inicial = 0

        es_favorito = False
        email_sesion = request.session.get('usuario_email')
        if email_sesion:
            usuario = db.usuarios.find_one({'email': email_sesion}, {'favoritos': 1}) or {}
            es_favorito = id_str in [str(fid).strip() for fid in usuario.get('favoritos', [])]

        categoria_actual = producto.get('categoria')
        filtro_rec = {'_id': {'$ne': producto['_id']}}
        if categoria_actual:
            filtro_rec['categoria'] = categoria_actual

        recomendados_raw = list(db.Productos.find(filtro_rec).limit(8))
        random.shuffle(recomendados_raw)
        recomendados = []
        for r in recomendados_raw[:4]:
            r['id_str'] = str(r['_id'])
            img_r = normalizar_url_imagen(r.get('imagen_url') or r.get('imagen', ''))
            r['imagen_url'] = img_r
            r['imagen'] = img_r
            recomendados.append(r)

        look_sugerido = obtener_completa_el_look(db.Productos, producto)

        return render(request, 'detalle_producto.html', {
            'producto': producto,
            'tallas_detalle': tallas_detalle,
            'talla_inicial': primera_disponible,
            'stock_inicial': stock_inicial,
            'es_favorito': es_favorito,
            'recomendados': recomendados,
            'look_sugerido': look_sugerido,
        })

    except Exception as e:
        print("--> Error exacto en detalle_producto_view:", str(e))
        messages.error(request, 'Ocurrió un error al cargar el producto.')
        return redirect('inicio')


# ==============================================================================
# TICKET DIGITAL CON CÓDIGO QR
# ==============================================================================

def generar_qr_pedido(request, pedido_id):
    """Genera dinámicamente la imagen PNG del código QR de un pedido."""
    try:
        if not ObjectId.is_valid(str(pedido_id)):
            return HttpResponse(status=400)

        pedido = db.pedidos.find_one({'_id': ObjectId(pedido_id)})
        if not pedido:
            return HttpResponse(status=404)

        folio = obtener_folio_pedido(pedido)
        contenido_qr = (
            f"VERTICE-TICKET|{folio}|{pedido_id}|"
            f"{pedido.get('usuario_email', '')}|${pedido.get('total', 0)}"
        )

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=8,
            border=2,
        )
        qr.add_data(contenido_qr)
        qr.make(fit=True)

        img = qr.make_image(fill_color="#111111", back_color="#FFFFFF")
        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        return HttpResponse(buffer.getvalue(), content_type="image/png")

    except Exception as e:
        print("--> Error generando QR de pedido:", e)
        return HttpResponse(status=400)


# ==============================================================================
# SECCIÓN DE PERFIL Y GESTIÓN DE USUARIO
# ==============================================================================

def perfil_view(request):
    email_sesion = request.session.get('usuario_email')
    if not email_sesion:
        return redirect('login')

    usuario = db.usuarios.find_one({'email': email_sesion}) or {}
    pedidos = list(db.pedidos.find({'usuario_email': email_sesion}).sort('_id', -1))
    for p in pedidos:
        p['id_str'] = str(p['_id'])
        p['folio'] = obtener_folio_pedido(p)
        p['producto_imagen'] = normalizar_url_imagen(p.get('producto_imagen', ''))

    tarjetas = list(db.tarjetas.find({
        '$or': [
            {'usuario_email': email_sesion},
            {'email_usuario': email_sesion}
        ]
    }))
    for t in tarjetas:
        t['id_str'] = str(t['_id'])

    favoritos_ids = [str(fid).strip() for fid in usuario.get('favoritos', []) if fid]
    productos_favoritos = []
    if favoritos_ids:
        object_ids = [ObjectId(fid) for fid in favoritos_ids if ObjectId.is_valid(fid)]
        productos_cursor = db.Productos.find({
            '$or': [
                {'_id': {'$in': object_ids}},
                {'_id': {'$in': favoritos_ids}}
            ]
        })
        mapa_productos = {}
        for prod in productos_cursor:
            pid = str(prod['_id'])
            prod['id_str'] = pid
            img = normalizar_url_imagen(prod.get('imagen_url') or prod.get('imagen', ''))
            prod['imagen_url'] = img
            prod['imagen'] = img
            stock_disp = obtener_stock_disponible(prod)
            prod['agotado'] = (stock_disp is not None and stock_disp <= 0)
            mapa_productos[pid] = prod

        for fid in reversed(favoritos_ids):
            if fid in mapa_productos:
                productos_favoritos.append(mapa_productos[fid])

    contexto = {
        'usuario': usuario,
        'pedidos': pedidos,
        'tarjetas': tarjetas,
        'productos_favoritos': productos_favoritos
    }
    return render(request, 'perfil.html', contexto)


def estado_pedidos_usuario_json(request):
    """Devuelve en JSON el estado actual de los pedidos del usuario logueado."""
    email_sesion = request.session.get('usuario_email')
    if not email_sesion:
        return JsonResponse({'ok': False, 'pedidos': []}, status=401)

    pedidos = list(db.pedidos.find({'usuario_email': email_sesion}, {'estado': 1}))
    data = [
        {
            'id_str': str(p['_id']),
            'estado': p.get('estado', 'Procesando')
        }
        for p in pedidos
    ]
    return JsonResponse({'ok': True, 'pedidos': data})


def actualizar_perfil_view(request):
    email_sesion = request.session.get('usuario_email')
    if not email_sesion:
        return redirect('login')

    if request.method == 'POST':
        nuevo_nombre = request.POST.get('nombre', '').strip()
        nuevos_apellidos = request.POST.get('apellidos', '').strip()

        if nuevo_nombre and nuevos_apellidos:
            db.usuarios.update_one(
                {'email': email_sesion},
                {'$set': {'nombre': nuevo_nombre, 'apellidos': nuevos_apellidos}}
            )
            request.session['usuario_nombre'] = nuevo_nombre
            messages.success(request, '¡Tus datos personales se han actualizado con éxito!')
        else:
            messages.error(request, 'Por favor completa todos los campos.')

    return redirect('perfil')


def cambiar_password_view(request):
    email_sesion = request.session.get('usuario_email')
    if not email_sesion:
        return redirect('login')

    if request.method == 'POST':
        pass_actual = request.POST.get('pass_actual', '')
        pass_nueva = request.POST.get('pass_nueva', '')

        usuario = db.usuarios.find_one({'email': email_sesion})

        if usuario and check_password(pass_actual, usuario.get('password', '')):
            if len(pass_nueva) >= 8:
                db.usuarios.update_one(
                    {'email': email_sesion},
                    {'$set': {'password': make_password(pass_nueva)}}
                )
                messages.success(request, '¡Tu contraseña ha sido actualizada correctamente!')
            else:
                messages.error(request, 'La nueva contraseña debe tener al menos 8 caracteres.')
        else:
            messages.error(request, 'La contraseña actual es incorrecta.')

    return redirect('perfil')


# ==============================================================================
# TARJETAS DE CRÉDITO Y DÉBITO
# ==============================================================================

def validar_luhn(numero_tarjeta):
    digits = [int(d) for d in numero_tarjeta if d.isdigit()]
    if not digits:
        return False
    checksum = digits.pop()
    digits.reverse()
    doubled = [d * 2 if i % 2 == 0 else d for i, d in enumerate(digits)]
    subtracted = [d - 9 if d > 9 else d for d in doubled]
    return (sum(subtracted) + checksum) % 10 == 0


def agregar_tarjeta_view(request):
    email_sesion = request.session.get('usuario_email')
    if not email_sesion:
        return redirect('login')

    if request.method == 'POST':
        numero_raw = re.sub(r'\D', '', request.POST.get('numero_tarjeta', ''))
        titular = request.POST.get('titular', '').strip().upper()
        expiracion = request.POST.get('expiracion', '').strip()
        cvv = request.POST.get('cvv', '').strip()

        if not re.match(r'^\d{15,16}$', numero_raw) or not validar_luhn(numero_raw):
            messages.error(request, 'El número de tarjeta ingresado no es válido.')
            return redirect('perfil')

        if not re.match(r'^(0[1-9]|1[0-2])\/\d{2}$', expiracion):
            messages.error(request, 'El formato de vencimiento debe ser MM/AA.')
            return redirect('perfil')

        if not re.match(r'^\d{3,4}$', cvv):
            messages.error(request, 'El código CVV es incorrecto.')
            return redirect('perfil')

        marca = 'Visa' if numero_raw.startswith('4') else ('Mastercard' if numero_raw.startswith(('5', '2')) else 'Vértice Card')
        cvv_encriptado = make_password(cvv)

        tarjeta_doc = {
            'email_usuario': email_sesion,
            'usuario_email': email_sesion,
            'titular': titular,
            'ultimos_4': numero_raw[-4:],
            'expiracion': expiracion,
            'cvv_encriptado': cvv_encriptado,
            'marca': marca,
            'fecha_registro': datetime.utcnow()
        }

        db.tarjetas.insert_one(tarjeta_doc)
        messages.success(request, '¡Tarjeta registrada exitosamente!')

    return redirect('perfil')


def eliminar_tarjeta_view(request, tarjeta_id):
    email_sesion = request.session.get('usuario_email')
    if not email_sesion:
        return redirect('login')

    if request.method == 'POST':
        try:
            resultado = db.tarjetas.delete_one({
                '_id': ObjectId(tarjeta_id),
                '$or': [
                    {'email_usuario': email_sesion},
                    {'usuario_email': email_sesion}
                ]
            })

            if resultado.deleted_count > 0:
                messages.success(request, 'La tarjeta se eliminó correctamente.')
            else:
                messages.error(request, 'No se encontró la tarjeta que deseas eliminar.')

        except Exception as e:
            print("--> Error al eliminar tarjeta:", e)
            messages.error(request, 'Error al procesar la eliminación de la tarjeta.')

    return redirect('perfil')


# ==============================================================================
# FORMULARIO DE CONTACTO
# ==============================================================================

def seccion_contacto(request):
    mensaje_exito = None
    error = None

    if request.method == 'POST':
        nombre = request.POST.get('nombre', '').strip()
        email = request.POST.get('email', '').strip()
        telefono = request.POST.get('telefono', '').strip()
        fecha_nacimiento = request.POST.get('fecha_nacimiento', '').strip()
        motivo = request.POST.get('motivo', '').strip()
        mensaje = request.POST.get('mensaje', '').strip()

        if not nombre or not email or not motivo or not mensaje:
            error = "Por favor completa todos los campos obligatorios."
            return render(request, 'contacto.html', {
                'error': error,
                'nombre': nombre,
                'email': email,
                'telefono': telefono,
                'fecha_nacimiento': fecha_nacimiento,
            })

        try:
            contacto_doc = {
                'nombre': nombre,
                'email': email,
                'telefono': telefono,
                'fecha_nacimiento': fecha_nacimiento,
                'motivo': motivo,
                'mensaje': mensaje,
                'estatus': 'Pendiente',
                'fecha_envio': datetime.utcnow()
            }
            db.mensajes_contacto.insert_one(contacto_doc)

            try:
                send_mail(
                    subject=f'Nuevo Contacto: {motivo} - {nombre}',
                    message=f'Nombre: {nombre}\nCorreo: {email}\nTeléfono: {telefono}\nMotivo: {motivo}\n\nMensaje:\n{mensaje}',
                    from_email='dan.are.nez.24@gmail.com',
                    recipient_list=['dan.are.nez.24@gmail.com'],
                    fail_silently=True,
                )
            except Exception as mail_err:
                print("Error enviando notificación por correo:", mail_err)

            mensaje_exito = "¡Gracias por contactarnos! Tu mensaje ha sido enviado correctamente."
            return render(request, 'contacto.html', {'mensaje_exito': mensaje_exito})

        except Exception as mongo_err:
            print("--> Error al guardar contacto en MongoDB:", mongo_err)
            error = "Ocurrió un problema al guardar tu mensaje. Por favor inténtalo de nuevo."

    return render(request, 'contacto.html')


def obtener_stock_disponible(producto, talla=None):
    """Obtiene el stock disponible soportando tanto un número entero como un diccionario por tallas."""
    stock = producto.get('stock')
    if stock is None:
        return None

    if isinstance(stock, dict):
        if talla:
            for clave in (talla, str(talla).upper(), str(talla).lower()):
                if clave in stock:
                    try:
                        return int(stock[clave])
                    except (ValueError, TypeError):
                        return 0
        valores = [
            int(v) for v in stock.values()
            if isinstance(v, (int, float)) or (isinstance(v, str) and v.isdigit())
        ]
        return sum(valores) if valores else None

    try:
        return int(stock)
    except (ValueError, TypeError):
        return None


def descontar_stock_producto(producto_id, talla, cantidad):
    """
    Descuenta (o restaura si cantidad < 0) unidades de forma atómica en MongoDB.
    Retorna True si el movimiento se realizó con éxito o si el producto no maneja stock;
    retorna False si ya no había existencias suficientes.
    """
    if not producto_id or not ObjectId.is_valid(str(producto_id)):
        return True

    producto = db.Productos.find_one({'_id': ObjectId(producto_id)})
    if not producto or 'stock' not in producto or producto.get('stock') is None:
        return True

    stock = producto.get('stock')
    cantidad = int(cantidad)

    if isinstance(stock, dict):
        clave_encontrada = None
        for clave in (talla, str(talla).upper(), str(talla).lower()):
            if clave in stock:
                clave_encontrada = clave
                break
        if clave_encontrada is not None:
            filtro = {'_id': ObjectId(producto_id)}
            if cantidad > 0:
                filtro[f'stock.{clave_encontrada}'] = {'$gte': cantidad}
            res = db.Productos.update_one(filtro, {'$inc': {f'stock.{clave_encontrada}': -cantidad}})
            return res.modified_count > 0
        return True

    elif isinstance(stock, (int, float)):
        filtro = {'_id': ObjectId(producto_id)}
        if cantidad > 0:
            filtro['stock'] = {'$gte': cantidad}
        res = db.Productos.update_one(filtro, {'$inc': {'stock': -cantidad}})
        return res.modified_count > 0

    return True


# ==============================================================================
# CARRITO DE COMPRAS, MINI-CART AJAX, CUPONES Y CHECKOUT DE PAGO
# ==============================================================================

def obtener_carrito_json(request):
    usuario_email = request.session.get('usuario_email')
    if not usuario_email:
        return JsonResponse({'items': [], 'total': 0, 'count': 0})

    carrito = db.carritos.find_one({'usuario_email': usuario_email})
    items = carrito.get('items', []) if carrito else []
    for item in items:
        item['imagen'] = normalizar_url_imagen(item.get('imagen', ''))

    total = sum(item['precio'] * item['cantidad'] for item in items)
    count = sum(item['cantidad'] for item in items)

    return JsonResponse({'items': items, 'total': total, 'count': count})


def agregar_al_carrito_view(request):
    if request.method == 'POST':
        es_ajax = request.headers.get('x-requested-with') == 'XMLHttpRequest'
        usuario_email = request.session.get('usuario_email')

        if not usuario_email:
            if es_ajax:
                return JsonResponse({
                    'ok': False,
                    'error': 'Inicia sesión para agregar prendas a tu bolsa.',
                    'login_url': reverse('login')
                }, status=401)
            messages.error(request, 'Debes iniciar sesión para agregar productos al carrito.')
            return redirect('login')

        producto_id = request.POST.get('producto_id')
        talla = request.POST.get('talla', 'Única')
        cantidad = max(1, int(request.POST.get('cantidad', 1)))

        producto = db.Productos.find_one({'_id': ObjectId(producto_id)})
        if not producto:
            if es_ajax:
                return JsonResponse({'ok': False, 'error': 'Producto no encontrado.'}, status=404)
            messages.error(request, 'Producto no encontrado.')
            return redirect('inicio')

        stock_disponible = obtener_stock_disponible(producto, talla)
        if stock_disponible is not None and stock_disponible <= 0:
            if es_ajax:
                return JsonResponse({'ok': False, 'error': f'La talla {talla} está agotada.'}, status=400)
            messages.error(request, f'La talla {talla} está agotada.')
            return redirect('inicio')

        if stock_disponible is not None and cantidad > stock_disponible:
            if es_ajax:
                return JsonResponse({
                    'ok': False,
                    'error': f'Solo quedan {stock_disponible} unidades disponibles en talla {talla}.'
                }, status=400)
            cantidad = stock_disponible

        item_nuevo = {
            'producto_id': str(producto['_id']),
            'nombre': producto['nombre'],
            'precio': float(producto['precio']),
            'imagen': normalizar_url_imagen(producto.get('imagen_url') or producto.get('imagen', '')),
            'talla': talla,
            'cantidad': cantidad
        }

        carrito = db.carritos.find_one({'usuario_email': usuario_email})
        if not carrito:
            items = [item_nuevo]
            db.carritos.insert_one({'usuario_email': usuario_email, 'items': items})
        else:
            items = carrito.get('items', [])
            encontrado = False
            for item in items:
                if item['producto_id'] == item_nuevo['producto_id'] and item['talla'] == talla:
                    nueva_cant = item['cantidad'] + cantidad
                    if stock_disponible is not None and nueva_cant > stock_disponible:
                        if es_ajax:
                            return JsonResponse({
                                'ok': False,
                                'error': f'Solo quedan {stock_disponible} unidades disponibles en talla {talla}.'
                            }, status=400)
                        nueva_cant = stock_disponible
                    item['cantidad'] = nueva_cant
                    encontrado = True
                    break
            if not encontrado:
                items.append(item_nuevo)
            db.carritos.update_one({'usuario_email': usuario_email}, {'$set': {'items': items}})

        total_count = sum(i['cantidad'] for i in items)

        if es_ajax:
            return JsonResponse({
                'ok': True,
                'count': total_count,
                'producto': producto['nombre'],
                'talla': talla
            })

        return redirect('checkout')

    return redirect('inicio')


def actualizar_item_carrito_ajax(request):
    """Permite sumar, restar o eliminar artículos desde el Mini-Cart lateral sin recargar."""
    if request.method == 'POST':
        usuario_email = request.session.get('usuario_email')
        if not usuario_email:
            return JsonResponse({'ok': False, 'error': 'Inicia sesión.'}, status=401)

        producto_id = str(request.POST.get('producto_id', '')).strip()
        talla = str(request.POST.get('talla', 'Única')).strip()
        accion = request.POST.get('accion', 'sumar')

        carrito = db.carritos.find_one({'usuario_email': usuario_email})
        if not carrito:
            return JsonResponse({'ok': True, 'items': [], 'total': 0, 'count': 0})

        items = carrito.get('items', [])
        nuevos_items = []

        for item in items:
            if item['producto_id'] == producto_id and item['talla'] == talla:
                if accion == 'eliminar':
                    continue
                elif accion == 'restar':
                    if item['cantidad'] > 1:
                        item['cantidad'] -= 1
                        item['imagen'] = normalizar_url_imagen(item.get('imagen', ''))
                        nuevos_items.append(item)
                elif accion == 'sumar':
                    prod_db = db.Productos.find_one({'_id': ObjectId(producto_id)}) if ObjectId.is_valid(producto_id) else None
                    stock_disp = obtener_stock_disponible(prod_db, talla) if prod_db else None
                    if stock_disp is not None and item['cantidad'] + 1 > stock_disp:
                        return JsonResponse({
                            'ok': False,
                            'error': f'Solo hay {stock_disp} unidades disponibles en talla {talla}.'
                        }, status=400)
                    item['cantidad'] += 1
                    item['imagen'] = normalizar_url_imagen(item.get('imagen', ''))
                    nuevos_items.append(item)
            else:
                item['imagen'] = normalizar_url_imagen(item.get('imagen', ''))
                nuevos_items.append(item)

        db.carritos.update_one({'usuario_email': usuario_email}, {'$set': {'items': nuevos_items}})
        total = sum(i['precio'] * i['cantidad'] for i in nuevos_items)
        count = sum(i['cantidad'] for i in nuevos_items)

        return JsonResponse({'ok': True, 'items': nuevos_items, 'total': total, 'count': count})

    return JsonResponse({'ok': False}, status=405)


def validar_cupon_ajax(request):
    """Valida un código promocional (ej. VERTICE10, BIENVENIDO15) o desde la colección db.cupones."""
    codigo = request.GET.get('codigo', '').strip().upper()
    if not codigo:
        return JsonResponse({'ok': False, 'error': 'Ingresa un código promocional.'})

    cupon_db = db.cupones.find_one({'codigo': codigo, 'activo': True})
    cupones_base = {
        'VERTICE10': 10,
        'BIENVENIDO15': 15,
        'VIP20': 20
    }

    if cupon_db:
        porcentaje = float(cupon_db.get('porcentaje', 10))
    elif codigo in cupones_base:
        porcentaje = cupones_base[codigo]
    else:
        return JsonResponse({'ok': False, 'error': 'El cupón no es válido o ha expirado.'})

    request.session['cupon_activo'] = {'codigo': codigo, 'porcentaje': porcentaje}
    request.session.modified = True

    return JsonResponse({
        'ok': True,
        'codigo': codigo,
        'porcentaje': porcentaje,
        'mensaje': f'¡Cupón {codigo} aplicado ({int(porcentaje)}% de descuento)!'
    })


def toggle_favorito_view(request):
    if request.method == 'POST':
        usuario_email = request.session.get('usuario_email')
        if not usuario_email:
            return JsonResponse({
                'ok': False,
                'error': 'Inicia sesión para guardar favoritos.',
                'login_url': reverse('login')
            }, status=401)

        producto_id = str(request.POST.get('producto_id', '')).strip()
        if not producto_id:
            return JsonResponse({'ok': False, 'error': 'ID inválido.'}, status=400)

        usuario = db.usuarios.find_one({'email': usuario_email}) or {}
        favoritos = [str(fid).strip() for fid in usuario.get('favoritos', []) if fid]

        if producto_id in favoritos:
            favoritos = [fid for fid in favoritos if fid != producto_id]
            agregado = False
        else:
            favoritos.append(producto_id)
            agregado = True

        db.usuarios.update_one(
            {'email': usuario_email},
            {'$set': {'favoritos': favoritos}}
        )
        return JsonResponse({'ok': True, 'agregado': agregado, 'total_favoritos': len(favoritos)})

    return JsonResponse({'ok': False}, status=405)


def obtener_favoritos_json(request):
    usuario_email = request.session.get('usuario_email')
    if not usuario_email:
        return JsonResponse({'favoritos': []})
    usuario = db.usuarios.find_one({'email': usuario_email}) or {}
    favoritos = [str(fid).strip() for fid in usuario.get('favoritos', []) if fid]
    return JsonResponse({'favoritos': favoritos})


def eliminar_item_carrito_view(request, producto_id, talla):
    usuario_email = request.session.get('usuario_email')
    if usuario_email:
        carrito = db.carritos.find_one({'usuario_email': usuario_email})
        if carrito:
            items = [i for i in carrito.get('items', []) if not (i['producto_id'] == producto_id and i['talla'] == talla)]
            db.carritos.update_one({'usuario_email': usuario_email}, {'$set': {'items': items}})

    return redirect('checkout')


def calcular_resumen_compra(subtotal, cupon_sesion=None):
    descuento = 0.0
    codigo_cupon = ''
    porcentaje = 0

    if cupon_sesion and subtotal > 0:
        codigo_cupon = cupon_sesion.get('codigo', '')
        porcentaje = float(cupon_sesion.get('porcentaje', 0))
        descuento = round(subtotal * (porcentaje / 100.0), 2)

    subtotal_con_desc = max(0.0, subtotal - descuento)
    envio = 0.0 if (subtotal_con_desc >= ENVIO_GRATIS_MINIMO or subtotal == 0) else COSTO_ENVIO_ESTANDAR
    total = round(subtotal_con_desc + envio, 2)
    faltante_envio_gratis = max(0.0, round(ENVIO_GRATIS_MINIMO - subtotal_con_desc, 2))

    return {
        'subtotal': round(subtotal, 2),
        'descuento': descuento,
        'codigo_cupon': codigo_cupon,
        'porcentaje_cupon': int(porcentaje),
        'envio': envio,
        'total': total,
        'faltante_envio_gratis': faltante_envio_gratis,
    }


def checkout_view(request):
    usuario_email = request.session.get('usuario_email')
    if not usuario_email:
        messages.error(request, 'Inicia sesión para revisar tu carrito y pagar.')
        return redirect('login')

    carrito = db.carritos.find_one({'usuario_email': usuario_email})
    items = carrito.get('items', []) if carrito else []
    for item in items:
        item['imagen'] = normalizar_url_imagen(item.get('imagen', ''))

    subtotal = sum(item['precio'] * item['cantidad'] for item in items)
    resumen = calcular_resumen_compra(subtotal, request.session.get('cupon_activo'))

    usuario = db.usuarios.find_one({'email': usuario_email}) or {}
    tarjetas_cursor = db.tarjetas.find({
        '$or': [
            {'usuario_email': usuario_email},
            {'email_usuario': usuario_email}
        ]
    })
    tarjetas = []
    for t in tarjetas_cursor:
        t['id_str'] = str(t['_id'])
        tarjetas.append(t)

    context = {
        'items': items,
        'subtotal': resumen['subtotal'],
        'descuento': resumen['descuento'],
        'codigo_cupon': resumen['codigo_cupon'],
        'porcentaje_cupon': resumen['porcentaje_cupon'],
        'envio': resumen['envio'],
        'total': resumen['total'],
        'faltante_envio_gratis': resumen['faltante_envio_gratis'],
        'usuario': usuario,
        'tarjetas': tarjetas,
        'count_items': sum(item['cantidad'] for item in items)
    }
    return render(request, 'checkout.html', context)


def procesar_pago_view(request):
    if request.method == 'POST':
        usuario_email = request.session.get('usuario_email')
        if not usuario_email:
            return redirect('login')

        carrito = db.carritos.find_one({'usuario_email': usuario_email})
        items = carrito.get('items', []) if carrito else []

        if not items:
            messages.error(request, 'Tu carrito está vacío.')
            return redirect('checkout')

        for item in items:
            prod_id = item.get('producto_id')
            talla = item.get('talla', 'Única')
            cant = int(item.get('cantidad', 1))

            prod_db = db.Productos.find_one({'_id': ObjectId(prod_id)}) if ObjectId.is_valid(str(prod_id)) else None
            if not prod_db:
                messages.error(request, f'La prenda "{item.get("nombre")}" ya no está disponible en el catálogo.')
                return redirect('checkout')

            stock_disp = obtener_stock_disponible(prod_db, talla)
            if stock_disp is not None and stock_disp < cant:
                if stock_disp <= 0:
                    messages.error(request, f'Lo sentimos, "{item.get("nombre")}" en talla {talla} se acaba de agotar.')
                else:
                    messages.error(request, f'Solo quedan {stock_disp} unidades de "{item.get("nombre")}" en talla {talla}. Ajusta tu carrito.')
                return redirect('checkout')

        items_descontados = []
        for item in items:
            exito = descontar_stock_producto(item['producto_id'], item['talla'], item['cantidad'])
            if not exito:
                for rev in items_descontados:
                    descontar_stock_producto(rev['producto_id'], rev['talla'], -int(rev['cantidad']))
                messages.error(request, f'"{item.get("nombre")}" (Talla {item.get("talla")}) se agotó justo antes de completar el pago.')
                return redirect('checkout')
            items_descontados.append(item)

        metodo_pago_seleccionado = request.POST.get('metodo_pago')

        if metodo_pago_seleccionado == 'nueva_tarjeta':
            num_tarjeta = request.POST.get('num_tarjeta', '')
            titular = request.POST.get('titular_tarjeta', '').upper()
            expiracion = request.POST.get('exp_tarjeta', '')
            ultimos_4 = num_tarjeta.replace(' ', '')[-4:] if len(num_tarjeta) >= 4 else '****'
            metodo_pago = f"Tarjeta **** {ultimos_4}"

            if request.POST.get('guardar_tarjeta_checkout'):
                db.tarjetas.insert_one({
                    "usuario_email": usuario_email,
                    "email_usuario": usuario_email,
                    "titular": titular,
                    "marca": "Visa/Mastercard",
                    "ultimos_4": ultimos_4,
                    "expiracion": expiracion,
                    "fecha_registro": datetime.utcnow()
                })
        else:
            metodo_pago = metodo_pago_seleccionado or "Tarjeta de Crédito/Débito"

        subtotal = sum(item['precio'] * item['cantidad'] for item in items)
        resumen = calcular_resumen_compra(subtotal, request.session.get('cupon_activo'))
        factor_descuento = (1 - resumen['porcentaje_cupon'] / 100.0) if resumen['porcentaje_cupon'] else 1.0

        fecha_actual = datetime.now().strftime("%d/%m/%Y %H:%M")
        ultimo_pedido_id = None
        folios_generados = []
        detalle_correo = []

        for item in items:
            folio_unico = f"VRT-{uuid.uuid4().hex[:6].upper()}"
            folios_generados.append(folio_unico)
            total_item = round(item['precio'] * item['cantidad'] * factor_descuento, 2)

            nuevo_pedido = {
                "folio": folio_unico,
                "usuario_email": usuario_email,
                "producto_id": item['producto_id'],
                "producto_nombre": item['nombre'],
                "producto_imagen": normalizar_url_imagen(item.get('imagen', '')),
                "precio_unitario": item['precio'],
                "talla": item['talla'],
                "cantidad": item['cantidad'],
                "total": total_item,
                "cupon_aplicado": resumen['codigo_cupon'] or None,
                "metodo_pago": metodo_pago,
                "estado": "Procesando",
                "fecha": fecha_actual
            }
            resultado_insert = db.pedidos.insert_one(nuevo_pedido)
            ultimo_pedido_id = str(resultado_insert.inserted_id)

            detalle_correo.append(f"- {item['nombre']} (Talla {item['talla']} x{item['cantidad']}): ${total_item} MXN | Folio: {folio_unico}")

        db.carritos.update_one({'usuario_email': usuario_email}, {'$set': {'items': []}})
        request.session.pop('cupon_activo', None)
        request.session.modified = True

        try:
            texto_envio = 'GRATIS' if resumen['envio'] == 0 else f"${resumen['envio']} MXN"
            cuerpo_email = (
                f"¡Gracias por tu compra en VÉRTICE!\n\n"
                f"Fecha: {fecha_actual}\n"
                f"Método de pago: {metodo_pago}\n"
                f"Envío: {texto_envio}\n"
                f"Total pagado: ${resumen['total']} MXN\n\n"
                f"Resumen de prendas:\n" + "\n".join(detalle_correo) +
                f"\n\nPuedes consultar tu Ticket Digital QR en tu perfil dentro de la tienda."
            )
            send_mail(
                subject=f"Confirmación de Pedido VÉRTICE ({', '.join(folios_generados)})",
                message=cuerpo_email,
                from_email='dan.are.nez.24@gmail.com',
                recipient_list=[usuario_email],
                fail_silently=True,
            )
        except Exception as mail_err:
            print("Error enviando confirmación de pedido:", mail_err)

        messages.success(request, '¡Pago realizado con éxito! Enviamos el resumen a tu correo y tu Ticket QR está listo.')
        if ultimo_pedido_id:
            return redirect(f"{reverse('perfil')}?tab=pedidos&ticket={ultimo_pedido_id}")
        return redirect('perfil')

    return redirect('checkout')


def agregar_pedido_view(request):
    if request.method == 'POST':
        usuario_email = request.session.get('usuario_email')
        if not usuario_email:
            messages.error(request, 'Debes iniciar sesión para realizar un pedido.')
            return redirect('login')

        producto_id = request.POST.get('producto_id')
        talla = request.POST.get('talla', 'N/A')
        cantidad = int(request.POST.get('cantidad', 1))

        producto = db.Productos.find_one({'_id': ObjectId(producto_id)})
        if not producto:
            messages.error(request, 'El producto no fue encontrado.')
            return redirect('inicio')

        if not descontar_stock_producto(producto_id, talla, cantidad):
            messages.error(request, f'Lo sentimos, "{producto["nombre"]}" en talla {talla} ya no tiene stock disponible.')
            return redirect('detalle_producto', producto_id=producto_id)

        precio_total = producto['precio'] * cantidad
        folio_unico = f"VRT-{uuid.uuid4().hex[:6].upper()}"

        nuevo_pedido = {
            "folio": folio_unico,
            "usuario_email": usuario_email,
            "producto_id": str(producto['_id']),
            "producto_nombre": producto['nombre'],
            "producto_imagen": normalizar_url_imagen(producto.get('imagen_url') or producto.get('imagen', '')),
            "precio_unitario": producto['precio'],
            "talla": talla,
            "cantidad": cantidad,
            "total": precio_total,
            "estado": "Procesando",
            "fecha": datetime.now().strftime("%d/%m/%Y %H:%M")
        }

        resultado_insert = db.pedidos.insert_one(nuevo_pedido)
        ultimo_pedido_id = str(resultado_insert.inserted_id)

        messages.success(request, f'¡"{producto["nombre"]}" guardado! Aquí tienes tu Ticket Digital QR.')
        return redirect(f"{reverse('perfil')}?tab=pedidos&ticket={ultimo_pedido_id}")

    return redirect('inicio')


# ==============================================================================
# PANEL DE ADMINISTRACIÓN (DASHBOARD, ANALÍTICA AVANZADA, PRODUCTOS, PEDIDOS, QR)
# ==============================================================================

@requiere_rol(roles_permitidos=['admin', 'superadmin'])
def admin_dashboard_view(request):
    usuario_email = request.session.get('usuario_email')
    usuario_actual = db.usuarios.find_one({'email': usuario_email}) or {}

    total_productos = db.Productos.count_documents({})
    total_pedidos = db.pedidos.count_documents({})
    total_usuarios = db.usuarios.count_documents({})

    pedidos_todos = list(db.pedidos.find({}).sort('_id', -1))
    productos_lista = list(db.Productos.find({}).sort('_id', -1))
    usuarios_todos = list(db.usuarios.find({}))

    # Mapa rápido de productos para cruzar categorías en las ventas
    mapa_prod_cat = {}
    for p in productos_lista:
        pid = str(p['_id'])
        p['id_str'] = pid
        img = normalizar_url_imagen(p.get('imagen_url') or p.get('imagen', ''))
        p['imagen_url'] = img
        p['imagen'] = img
        tallas_val = p.get('tallas', ['S', 'M', 'L', 'XL'])
        p['tallas_str'] = ', '.join(tallas_val) if isinstance(tallas_val, list) else str(tallas_val)
        p['stock_numerico'] = obtener_stock_disponible(p)
        p['es_stock_por_talla'] = isinstance(p.get('stock'), dict)
        mapa_prod_cat[pid] = str(p.get('categoria', 'otros')).lower()

    # Cálculos de analítica financiera y operativa
    nombres_cat = {'el': 'ÉL', 'ella': 'ELLA', 'niños': 'NIÑOS', 'fin_año': 'FIN DE AÑO'}
    ingresos_totales = 0.0
    pedidos_validos = 0
    unidades_vendidas_total = 0

    ingresos_por_dia = defaultdict(float)
    pedidos_por_dia = defaultdict(int)
    ingresos_por_categoria = defaultdict(float)
    ventas_por_talla = Counter()
    unidades_por_prenda = Counter()
    ingresos_por_prenda = defaultdict(float)
    metodos_pago_count = Counter()
    estados_count = Counter()
    gasto_por_cliente = defaultdict(float)

    for p in pedidos_todos:
        p['id_str'] = str(p['_id'])
        p['folio'] = obtener_folio_pedido(p)
        estado = p.get('estado', 'Procesando')
        estados_count[estado] += 1

        if estado == 'Cancelado':
            continue

        total_ped = float(p.get('total', 0))
        cant_ped = int(p.get('cantidad', 1))
        ingresos_totales += total_ped
        pedidos_validos += 1
        unidades_vendidas_total += cant_ped

        fecha_raw = str(p.get('fecha', '')).strip()
        dia = fecha_raw.split(' ')[0] if fecha_raw else 'Sin fecha'
        ingresos_por_dia[dia] += total_ped
        pedidos_por_dia[dia] += 1

        cat_key = mapa_prod_cat.get(str(p.get('producto_id', '')), 'otros')
        cat_label = nombres_cat.get(cat_key, cat_key.upper() if cat_key != 'otros' else 'GENERAL')
        ingresos_por_categoria[cat_label] += total_ped

        talla_ped = str(p.get('talla', 'Única')).upper()
        ventas_por_talla[talla_ped] += cant_ped

        nombre_p = p.get('producto_nombre', 'Prenda Vértice')
        unidades_por_prenda[nombre_p] += cant_ped
        ingresos_por_prenda[nombre_p] += total_ped

        metodo = p.get('metodo_pago', 'Tarjeta')
        if '****' in metodo:
            metodo = 'Tarjeta Guardada / Débito'
        metodos_pago_count[metodo] += 1

        cliente_email = p.get('usuario_email', 'Invitado')
        gasto_por_cliente[cliente_email] += total_ped

    ingresos_totales = round(ingresos_totales, 2)
    ticket_promedio = round(ingresos_totales / pedidos_validos, 2) if pedidos_validos > 0 else 0.0

    # 1. Serie temporal: Ingresos (MXN) y Volumen de Pedidos por día (últimos 10 días con movimiento)
    dias_ordenados = list(reversed(list(ingresos_por_dia.keys())))[-10:]
    if not dias_ordenados:
        dias_ordenados = ['Sin registros']
    serie_ingresos = [round(ingresos_por_dia[d], 2) for d in dias_ordenados]
    serie_pedidos_dia = [pedidos_por_dia[d] for d in dias_ordenados]

    # 2. Ingresos generados por categoría (MXN)
    if ingresos_por_categoria:
        cat_ing_labels = list(ingresos_por_categoria.keys())
        cat_ing_values = [round(ingresos_por_categoria[k], 2) for k in cat_ing_labels]
    else:
        cat_ing_labels = ['ÉL', 'ELLA', 'NIÑOS', 'FIN DE AÑO']
        cat_ing_values = [0, 0, 0, 0]

    # 3. Inventario: Stock disponible por categoría + alertas de stock bajo (< 5 uds)
    stock_por_cat = defaultdict(int)
    stock_bajo_items = []
    for prod in productos_lista:
        c_label = nombres_cat.get(str(prod.get('categoria', '')).lower(), 'OTROS')
        stk = prod.get('stock_numerico')
        if stk is not None:
            stock_por_cat[c_label] += stk
            if stk <= 5:
                stock_bajo_items.append({'nombre': prod.get('nombre', ''), 'stock': stk})

    inv_cat_labels = list(stock_por_cat.keys()) or ['Sin stock']
    inv_cat_values = [stock_por_cat[k] for k in inv_cat_labels]

    # 4. Demanda por Talla (S, M, L, XL, etc.)
    orden_tallas = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'ÚNICA']
    tallas_presentes = [t for t in orden_tallas if ventas_por_talla[t] > 0]
    for t in ventas_por_talla:
        if t not in tallas_presentes:
            tallas_presentes.append(t)
    tallas_labels = tallas_presentes or ['S', 'M', 'L', 'XL']
    tallas_values = [ventas_por_talla[t] for t in tallas_labels]

    # 5. Estado de Pedidos
    estados_orden = ['Procesando', 'Enviado', 'Entregado', 'Cancelado']
    est_labels = estados_orden
    est_values = [estados_count.get(e, 0) for e in estados_orden]

    # 6. Top 5 Prendas Más Vendidas (unidades e ingresos)
    top_prendas = unidades_por_prenda.most_common(5)
    top_labels = [t[0][:22] + ('…' if len(t[0]) > 22 else '') for t in top_prendas] or ['Sin ventas']
    top_unidades = [t[1] for t in top_prendas] or [0]
    top_ingresos = [round(ingresos_por_prenda[t[0]], 2) for t in top_prendas] or [0]

    # 7. Canales de Registro de Usuarios (Web / Google / QR)
    metodos_reg_map = {
        'google_web': 'Google OAuth',
        'qr_google': 'Escaneo QR',
    }
    reg_counter = Counter(
        metodos_reg_map.get(u.get('metodo_registro', ''), 'Correo y Contraseña')
        for u in usuarios_todos
    )
    reg_labels = list(reg_counter.keys()) or ['Correo y Contraseña']
    reg_values = list(reg_counter.values()) or [0]

    # 8. Top 5 Clientes por monto comprado
    top_clientes_raw = sorted(gasto_por_cliente.items(), key=lambda x: x[1], reverse=True)[:5]
    clientes_labels = [c[0].split('@')[0] for c in top_clientes_raw] or ['Sin clientes']
    clientes_values = [round(c[1], 2) for c in top_clientes_raw] or [0]

    ultimos_pedidos = paginar_lista(request, pedidos_todos, por_pagina=15, param_pagina='page_pedidos')
    productos = paginar_lista(request, productos_lista, por_pagina=20, param_pagina='page_productos')

    mensajes_contacto = list(db.mensajes_contacto.find({}).sort('_id', -1).limit(30))
    mensajes_pendientes = 0
    for m in mensajes_contacto:
        m['id_str'] = str(m['_id'])
        fecha_env = m.get('fecha_envio')
        m['fecha_formateada'] = fecha_env.strftime("%d/%m/%Y %H:%M") if isinstance(fecha_env, datetime) else str(fecha_env or '')
        if m.get('estatus', 'Pendiente') == 'Pendiente':
            mensajes_pendientes += 1

    usuarios = usuarios_todos if usuario_actual.get('rol') == 'superadmin' else []
    for u in usuarios:
        u['id_str'] = str(u['_id'])

    analytics_payload = {
        'dias_labels': dias_ordenados,
        'serie_ingresos': serie_ingresos,
        'serie_pedidos_dia': serie_pedidos_dia,
        'cat_ing_labels': cat_ing_labels,
        'cat_ing_values': cat_ing_values,
        'inv_cat_labels': inv_cat_labels,
        'inv_cat_values': inv_cat_values,
        'tallas_labels': tallas_labels,
        'tallas_values': tallas_values,
        'est_labels': est_labels,
        'est_values': est_values,
        'top_labels': top_labels,
        'top_unidades': top_unidades,
        'top_ingresos': top_ingresos,
        'reg_labels': reg_labels,
        'reg_values': reg_values,
        'clientes_labels': clientes_labels,
        'clientes_values': clientes_values,
    }

    contexto = {
        'usuario_actual': usuario_actual,
        'total_productos': total_productos,
        'total_pedidos': total_pedidos,
        'total_usuarios': total_usuarios,
        'ingresos_totales': f"{ingresos_totales:,.2f}",
        'ticket_promedio': f"{ticket_promedio:,.2f}",
        'unidades_vendidas_total': unidades_vendidas_total,
        'stock_bajo_count': len(stock_bajo_items),
        'ultimos_pedidos': ultimos_pedidos,
        'productos': productos,
        'mensajes_contacto': mensajes_contacto,
        'mensajes_pendientes': mensajes_pendientes,
        'usuarios': usuarios,
        'analytics_json': json.dumps(analytics_payload),
    }
    return render(request, 'admin_dashboard.html', contexto)


@requiere_rol(roles_permitidos=['admin', 'superadmin'])
def admin_crear_producto_view(request):
    if request.method == 'POST':
        nombre = request.POST.get('nombre', '').strip()
        precio = float(request.POST.get('precio', 0))
        precio_original = request.POST.get('precio_original')
        categoria = request.POST.get('categoria', 'el')
        imagen_archivo = request.FILES.get('imagen_archivo')
        imagen_url = request.POST.get('imagen_url', '').strip()
        descripcion = request.POST.get('descripcion', '').strip()
        tallas_raw = request.POST.get('tallas', 'S,M,L,XL')

        if imagen_archivo:
            imagen_url = guardar_imagen_subida(imagen_archivo)

        if not imagen_url:
            messages.error(request, 'Debes subir una imagen o ingresar una URL/ruta válida.')
            return redirect('admin_dashboard')

        try:
            stock = max(0, int(request.POST.get('stock', 15)))
        except ValueError:
            stock = 15

        tallas_lista = [t.strip().upper() for t in tallas_raw.split(',') if t.strip()]

        nuevo_prod = {
            'nombre': nombre,
            'precio': precio,
            'precio_original': float(precio_original) if precio_original else None,
            'categoria': categoria,
            'imagen': imagen_url,
            'imagen_url': imagen_url,
            'descripcion': descripcion,
            'tallas': tallas_lista,
            'stock': stock,
            'fecha_creacion': datetime.utcnow()
        }

        db.Productos.insert_one(nuevo_prod)
        messages.success(request, f'Prenda "{nombre}" agregada al catálogo con {stock} unidades en stock.')

    return redirect('admin_dashboard')


@requiere_rol(roles_permitidos=['admin', 'superadmin'])
def admin_editar_producto_view(request, producto_id):
    if request.method == 'POST':
        try:
            filtro_id = {'_id': ObjectId(producto_id)} if ObjectId.is_valid(str(producto_id)) else {'_id': str(producto_id)}
            producto_actual = db.Productos.find_one(filtro_id)

            if not producto_actual:
                messages.error(request, 'No se encontró la prenda a editar.')
                return redirect('admin_dashboard')

            nombre = request.POST.get('nombre', '').strip() or producto_actual.get('nombre', '')
            precio = float(request.POST.get('precio', producto_actual.get('precio', 0)))
            precio_orig_raw = request.POST.get('precio_original', '').strip()
            precio_original = float(precio_orig_raw) if precio_orig_raw else None
            categoria = request.POST.get('categoria', producto_actual.get('categoria', 'el'))
            descripcion = request.POST.get('descripcion', '').strip()
            tallas_raw = request.POST.get('tallas', 'S,M,L,XL')
            tallas_lista = [t.strip().upper() for t in tallas_raw.split(',') if t.strip()]

            imagen_archivo = request.FILES.get('imagen_archivo')
            imagen_url_input = request.POST.get('imagen_url', '').strip()

            if imagen_archivo:
                nueva_imagen = guardar_imagen_subida(imagen_archivo)
            elif imagen_url_input:
                nueva_imagen = imagen_url_input
            else:
                nueva_imagen = producto_actual.get('imagen_url') or producto_actual.get('imagen', '')

            campos_actualizar = {
                'nombre': nombre,
                'precio': precio,
                'precio_original': precio_original,
                'categoria': categoria,
                'imagen': nueva_imagen,
                'imagen_url': nueva_imagen,
                'descripcion': descripcion,
                'tallas': tallas_lista,
            }

            stock_raw = request.POST.get('stock', '').strip()
            if stock_raw != '' and not isinstance(producto_actual.get('stock'), dict):
                try:
                    campos_actualizar['stock'] = max(0, int(stock_raw))
                except ValueError:
                    pass

            db.Productos.update_one(filtro_id, {'$set': campos_actualizar})
            messages.success(request, f'Prenda "{nombre}" actualizada correctamente.')

        except Exception as e:
            print("--> Error al editar producto:", e)
            messages.error(request, 'Ocurrió un error al actualizar la prenda.')

    return redirect('admin_dashboard')


@requiere_rol(roles_permitidos=['admin', 'superadmin'])
def admin_cambiar_estatus_contacto_view(request, mensaje_id):
    if request.method == 'POST':
        nuevo_estatus = request.POST.get('estatus', 'Atendido').strip()
        try:
            filtro_id = {'_id': ObjectId(mensaje_id)} if ObjectId.is_valid(str(mensaje_id)) else {'_id': str(mensaje_id)}
            db.mensajes_contacto.update_one(filtro_id, {'$set': {'estatus': nuevo_estatus}})
            messages.success(request, f'Mensaje marcado como "{nuevo_estatus}".')
        except Exception as e:
            print("--> Error al actualizar mensaje de contacto:", e)
            messages.error(request, 'No se pudo actualizar el estatus del mensaje.')

    return redirect('admin_dashboard')


@requiere_rol(roles_permitidos=['admin', 'superadmin'])
def admin_eliminar_contacto_view(request, mensaje_id):
    if request.method == 'POST':
        try:
            filtro_id = {'_id': ObjectId(mensaje_id)} if ObjectId.is_valid(str(mensaje_id)) else {'_id': str(mensaje_id)}
            db.mensajes_contacto.delete_one(filtro_id)
            messages.success(request, 'Mensaje eliminado de la bandeja.')
        except Exception as e:
            print("--> Error al eliminar mensaje de contacto:", e)
            messages.error(request, 'Error al eliminar el mensaje.')

    return redirect('admin_dashboard')


@requiere_rol(roles_permitidos=['admin', 'superadmin'])
def admin_eliminar_producto_view(request, producto_id):
    if request.method == 'POST':
        try:
            db.Productos.delete_one({'_id': ObjectId(producto_id)})
            messages.success(request, 'Producto eliminado del catálogo.')
        except Exception as e:
            messages.error(request, 'Error al eliminar el producto.')

    return redirect('admin_dashboard')


@requiere_rol(roles_permitidos=['admin', 'superadmin'])
def admin_cambiar_estado_pedido_view(request, pedido_id):
    if request.method == 'POST':
        nuevo_estado = request.POST.get('estado', 'Procesando').strip()
        try:
            filtro_id = {'_id': ObjectId(pedido_id)} if ObjectId.is_valid(str(pedido_id)) else {'_id': str(pedido_id)}
            pedido = db.pedidos.find_one(filtro_id)

            if pedido:
                estado_anterior = pedido.get('estado', 'Procesando')
                db.pedidos.update_one(
                    filtro_id,
                    {'$set': {'estado': nuevo_estado}}
                )

                prod_id = pedido.get('producto_id')
                talla = pedido.get('talla', 'Única')
                cantidad = int(pedido.get('cantidad', 1))

                if estado_anterior != 'Cancelado' and nuevo_estado == 'Cancelado':
                    descontar_stock_producto(prod_id, talla, -cantidad)
                elif estado_anterior == 'Cancelado' and nuevo_estado != 'Cancelado':
                    descontar_stock_producto(prod_id, talla, cantidad)

                messages.success(request, f'Estado actualizado a "{nuevo_estado}".')
            else:
                messages.error(request, 'No se encontró el pedido.')
        except Exception as e:
            print("--> Error al actualizar estado del pedido:", e)
            messages.error(request, 'Error al actualizar el estado.')

    return redirect('admin_dashboard')


@requiere_rol(roles_permitidos=['superadmin'])
def admin_cambiar_rol_usuario_view(request, usuario_id):
    if request.method == 'POST':
        nuevo_rol = request.POST.get('rol', 'cliente')
        try:
            db.usuarios.update_one(
                {'_id': ObjectId(usuario_id)},
                {'$set': {'rol': nuevo_rol}}
            )
            messages.success(request, 'Rol de usuario actualizado.')
        except Exception as e:
            messages.error(request, 'Error al cambiar el rol.')

    return redirect('admin_dashboard')


@requiere_rol(roles_permitidos=['admin', 'superadmin'])
def admin_verificar_ticket(request):
    """Valida un folio o cadena QR desde el panel de administración y permite marcarlo como Entregado."""
    codigo = request.GET.get('codigo', '').strip() or request.POST.get('codigo', '').strip()
    accion = request.POST.get('accion', '')

    if not codigo:
        return JsonResponse({'ok': False, 'error': 'Ingresa o escanea un folio o código QR.'})

    if 'VERTICE-TICKET|' in codigo:
        partes = codigo.split('|')
        codigo = partes[1] if len(partes) > 1 else codigo

    pedido = db.pedidos.find_one({'folio': {'$regex': f'^{re.escape(codigo)}$', '$options': 'i'}})
    if not pedido:
        for p in db.pedidos.find().sort('_id', -1).limit(200):
            if obtener_folio_pedido(p).upper() == codigo.upper() or str(p['_id']) == codigo:
                pedido = p
                break

    if not pedido:
        return JsonResponse({'ok': False, 'error': f'No se encontró ningún pedido con el folio "{codigo}".'})

    if accion == 'marcar_entregado':
        db.pedidos.update_one({'_id': pedido['_id']}, {'$set': {'estado': 'Entregado'}})
        pedido['estado'] = 'Entregado'

    return JsonResponse({
        'ok': True,
        'pedido': {
            'id_str': str(pedido['_id']),
            'folio': obtener_folio_pedido(pedido),
            'cliente': pedido.get('usuario_email', 'N/A'),
            'producto': pedido.get('producto_nombre', 'Prenda Vértice'),
            'talla': pedido.get('talla', 'Única'),
            'cantidad': pedido.get('cantidad', 1),
            'total': pedido.get('total', 0),
            'fecha': pedido.get('fecha', ''),
            'estado': pedido.get('estado', 'Procesando'),
        }
    })


# ==============================================================================
# PROBADOR VIRTUAL: RECORTE DE PRENDA CON IA (REMBG + CACHÉ LOCAL)
# ==============================================================================

_rembg_session = None


def recortar_prenda_ia_view(request, producto_id):
    """
    Elimina el fondo de una prenda usando rembg (IA) y guarda el PNG transparente
    en static/media/cutouts/ para que las siguientes consultas sean instantáneas.
    """
    global _rembg_session
    try:
        clean_id = str(producto_id).strip()
        cutouts_dir = os.path.join(settings.BASE_DIR, 'static', 'media', 'cutouts')
        os.makedirs(cutouts_dir, exist_ok=True)

        nombre_png = f"{re.sub(r'[^a-zA-Z0-9_-]', '', clean_id)}.png"
        ruta_cutout = os.path.join(cutouts_dir, nombre_png)
        url_cutout = static(f"media/cutouts/{nombre_png}")

        if os.path.exists(ruta_cutout) and os.path.getsize(ruta_cutout) > 0:
            return JsonResponse({'ok': True, 'cutout_url': url_cutout, 'cached': True})

        producto = None
        if ObjectId.is_valid(clean_id):
            producto = db.Productos.find_one({'_id': ObjectId(clean_id)})
        if not producto:
            producto = db.Productos.find_one({'_id': clean_id})

        if not producto:
            return JsonResponse({'ok': False, 'error': 'Producto no encontrado.'}, status=404)

        ruta_raw = str(producto.get('imagen_url') or producto.get('imagen', '')).strip()
        match_tag = re.match(r"^\{%\s*static\s+['\"]([^'\"]+)['\"]\s*%\}$", ruta_raw)
        if match_tag:
            ruta_raw = match_tag.group(1).strip()

        input_bytes = None
        if ruta_raw.startswith(('http://', 'https://')):
            import urllib.request
            req = urllib.request.Request(ruta_raw, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(req, timeout=15) as resp:
                input_bytes = resp.read()
        else:
            rel_path = ruta_raw.lstrip('/')
            if rel_path.startswith('static/'):
                rel_path = rel_path[len('static/'):]
            elif '/' not in rel_path:
                rel_path = f'media/{rel_path}'

            ruta_local = os.path.join(settings.BASE_DIR, 'static', rel_path.replace('/', os.sep))
            if os.path.exists(ruta_local):
                with open(ruta_local, 'rb') as f:
                    input_bytes = f.read()

        if not input_bytes:
            return JsonResponse({'ok': False, 'error': 'No se encontró el archivo de imagen de la prenda.'}, status=404)

        from rembg import new_session, remove
        if _rembg_session is None:
            _rembg_session = new_session("u2net")

        output_bytes = remove(input_bytes, session=_rembg_session)

        with open(ruta_cutout, 'wb') as out_f:
            out_f.write(output_bytes)

        return JsonResponse({'ok': True, 'cutout_url': url_cutout, 'cached': False})

    except ImportError:
        return JsonResponse({
            'ok': False,
            'error': 'La librería rembg no está instalada en el servidor.'
        }, status=500)
    except Exception as e:
        print("--> Error en recortar_prenda_ia_view:", e)
        return JsonResponse({'ok': False, 'error': str(e)}, status=500)


def probar_prenda_generativa_view(request, producto_id):
    if request.method != 'POST':
        return JsonResponse({'ok': False, 'error': 'Método no permitido'}, status=405)

    foto_usuario = request.FILES.get('user_image')
    if not foto_usuario:
        return JsonResponse({'ok': False, 'error': 'Falta la foto del usuario'}, status=400)

    try:
        producto = db.Productos.find_one({'_id': ObjectId(producto_id)})
    except Exception:
        producto = None

    if not producto:
        return JsonResponse({'ok': False, 'error': 'Producto no encontrado'}, status=404)

    base_static = os.path.join(settings.BASE_DIR, 'static')
    vton_dir = os.path.join(base_static, 'media', 'vton')
    os.makedirs(vton_dir, exist_ok=True)

    uid = uuid.uuid4().hex[:10]
    user_temp_path = os.path.join(vton_dir, f'user_{uid}.png')
    garment_temp_path = os.path.join(vton_dir, f'garment_{uid}.png')

    try:
        with open(user_temp_path, 'wb+') as dest:
            for chunk in foto_usuario.chunks():
                dest.write(chunk)

        cutout_path = os.path.join(base_static, 'media', 'cutouts', f'{producto_id}.png')
        img_url = producto.get('imagen_url') or producto.get('imagen', '')

        if os.path.exists(cutout_path):
            shutil.copy(cutout_path, garment_temp_path)
        elif img_url.startswith('http'):
            r = requests.get(img_url, timeout=15)
            r.raise_for_status()
            with open(garment_temp_path, 'wb') as f:
                f.write(r.content)
        else:
            rel_path = img_url.lstrip('/')
            if rel_path.startswith('static/'):
                rel_path = rel_path[7:]
            local_img = os.path.join(base_static, rel_path)
            shutil.copy(local_img, garment_temp_path)

        from gradio_client import Client, handle_file

        hf_token = os.environ.get('HF_TOKEN') or None
        client = Client("yisol/IDM-VTON", token=hf_token)

        nombre_p = (producto.get('nombre') or '').strip()
        subcat_p = (producto.get('subcategoria') or producto.get('categoria') or '').strip()
        desc_p = (producto.get('descripcion') or '').strip()

        descripcion_prenda = f"{nombre_p}, {subcat_p}. {desc_p}".strip(" ,.")
        if not descripcion_prenda:
            descripcion_prenda = "high quality fashion garment, realistic fabric texture"

        result = client.predict(
            dict={"background": handle_file(user_temp_path), "layers": [], "composite": None},
            garm_img=handle_file(garment_temp_path),
            garment_des=descripcion_prenda[:220],
            is_checked=True,
            is_checked_crop=False,
            denoise_steps=40,
            seed=42,
            api_name="/tryon"
        )

        generated_temp = result[0] if isinstance(result, (list, tuple)) else result
        out_filename = f'result_{producto_id}_{uid}.png'
        out_path = os.path.join(vton_dir, out_filename)
        shutil.copy(generated_temp, out_path)

        for p in (user_temp_path, garment_temp_path):
            if os.path.exists(p):
                os.remove(p)

        return JsonResponse({
            'ok': True,
            'result_url': f'/static/media/vton/{out_filename}'
        })

    except Exception as e:
        for p in (user_temp_path, garment_temp_path):
            if os.path.exists(p):
                os.remove(p)
        return JsonResponse({
            'ok': False,
            'error': f'El servidor de IA está ocupado o tardó demasiado: {str(e)}'
        }, status=500)


def estilista_ia_chat_view(request):
    if request.method != 'POST':
        return JsonResponse({'ok': False, 'error': 'Método no permitido'}, status=405)

    try:
        body = json.loads(request.body.decode('utf-8'))
    except Exception:
        body = {}

    mensaje_usuario = (body.get('mensaje') or '').strip()
    historial = body.get('historial') or []

    if not mensaje_usuario:
        return JsonResponse({'ok': False, 'error': 'Escribe un mensaje para el estilista.'}, status=400)

    MENSAJE_FUERA_CONTEXTO = (
        "Lo siento, no puedo ayudarte con esa solicitud. Soy el estilista virtual de **VÉRTICE** "
        "y únicamente puedo asesorarte sobre outfits, combinaciones de ropa, tallas, precios "
        "y prendas disponibles en nuestra tienda."
    )

    productos_db = list(db.Productos.find({'agotado': {'$ne': True}}).limit(60))
    catalogo_resumido = []
    mapa_productos = {}

    for p in productos_db:
        pid = str(p.get('_id'))
        tallas_disp = []
        tallas_raw = p.get('tallas_stock') or p.get('tallas') or ['CH', 'M', 'G']
        if isinstance(tallas_raw, dict):
            tallas_disp = [k for k, v in tallas_raw.items() if (v or 0) > 0]
        elif isinstance(tallas_raw, list):
            tallas_disp = [str(t) for t in tallas_raw]

        item = {
            'id': pid,
            'nombre': p.get('nombre', 'Prenda Vértice'),
            'categoria': p.get('categoria', ''),
            'subcategoria': p.get('subcategoria', ''),
            'precio': float(p.get('precio', 0)),
            'descripcion': (p.get('descripcion') or '')[:140],
            'tallas': tallas_disp or ['M'],
            'imagen': p.get('imagen_url') or p.get('imagen') or '/static/media/logo1.png'
        }
        catalogo_resumido.append(item)
        mapa_productos[pid] = item

    api_key = os.environ.get('GEMINI_API_KEY')
    respuesta_texto = ''
    ids_recomendados = []
    fuera_de_tema = False

    if api_key:
        try:
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=api_key)

            catalogo_texto = json.dumps([
                {
                    'id': c['id'],
                    'nombre': c['nombre'],
                    'categoria': c['categoria'],
                    'subcategoria': c['subcategoria'],
                    'precio': c['precio'],
                    'descripcion': c['descripcion']
                }
                for c in catalogo_resumido
            ], ensure_ascii=False)

            system_prompt = (
                "Eres el Estilista Personal oficial de VÉRTICE, una tienda de moda y ropa en México.\n"
                "REGLA ESTRICTA DE DOMINIO:\n"
                "- SOLO puedes responder preguntas relacionadas con ropa, moda, outfits, combinaciones, ocasiones de vestimenta, tallas, estilos, precios o productos de VÉRTICE (y saludos cordiales).\n"
                "- Si el usuario pregunta cualquier cosa ajena a la tienda o a la moda (matemáticas, tareas, programación, cultura general, chistes, política, etc.), "
                'debes devolver exactamente: {"fuera_de_contexto": true, "respuesta": "", "product_ids": []}.\n'
                "- Si sí es sobre moda o la tienda, responde en formato JSON válido con:\n"
                '{"fuera_de_contexto": false, "respuesta": "Tu consejo breve y persuasivo en español", "product_ids": ["id1", "id2"]}\n'
                f"CATÁLOGO DISPONIBLE EN TIENDA:\n{catalogo_texto}"
            )

            conversacion = ""
            for turno in historial[-4:]:
                rol = "Cliente" if turno.get('role') == 'user' else "Estilista"
                conversacion += f"{rol}: {turno.get('text', '')}\n"
            conversacion += f"Cliente: {mensaje_usuario}"

            response = client.models.generate_content(
                model='gemini-2.5-flash',
                contents=conversacion,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    response_mime_type='application/json',
                    temperature=0.3
                )
            )

            parsed = json.loads(response.text)
            if parsed.get('fuera_de_contexto'):
                fuera_de_tema = True
                respuesta_texto = MENSAJE_FUERA_CONTEXTO
                ids_recomendados = []
            else:
                respuesta_texto = parsed.get('respuesta', '')
                ids_recomendados = [pid for pid in parsed.get('product_ids', []) if pid in mapa_productos]
        except Exception as e:
            print("Fallback estilista local por error en Gemini:", e)

    if not fuera_de_tema and not respuesta_texto:
        msg_lower = mensaje_usuario.lower()
        tokens = set(re.findall(r'[a-záéíóúñ]+', msg_lower))

        saludos = {'hola', 'buenas', 'buenos', 'dias', 'tardes', 'noches', 'hey', 'que', 'tal'}
        if tokens and tokens.issubset(saludos):
            return JsonResponse({
                'ok': True,
                'respuesta': '¡Hola! Bienvenido a **VÉRTICE**. Cuéntame qué estilo buscas, para qué ocasión o tu presupuesto y te recomiendo prendas de nuestro catálogo.',
                'productos': []
            })

        palabras_moda = {
            'ropa', 'outfit', 'outfits', 'look', 'looks', 'vestir', 'vestimenta', 'prenda', 'prendas',
            'estilo', 'combinar', 'combinacion', 'moda', 'talla', 'tallas', 'precio', 'precios',
            'barato', 'economico', 'presupuesto', 'pesos', 'mxn', 'catalogo', 'tienda', 'vertice',
            'sudadera', 'sudaderas', 'playera', 'playeras', 'camisa', 'camisas', 'pantalon', 'pantalones',
            'jeans', 'cargo', 'chamarra', 'chamarras', 'abrigo', 'hoodie', 'sueter', 'tenis', 'calzado',
            'short', 'falda', 'gorra', 'accesorios', 'hombre', 'mujer', 'nino', 'niño', 'unisex',
            'casual', 'formal', 'urbano', 'elegante', 'deportivo', 'comodo', 'oversize', 'boxy', 'slim',
            'cita', 'fiesta', 'cena', 'trabajo', 'oficina', 'escuela', 'universidad', 'salir', 'viaje',
            'playa', 'boda', 'graduacion', 'evento', 'frio', 'frío', 'calor', 'lluvia', 'noche', 'dia',
            'invierno', 'verano', 'negro', 'blanco', 'azul', 'cafe', 'verde', 'gris', 'beige', 'rojo'
        }

        palabras_catalogo = set()
        for item in catalogo_resumido:
            texto_cat = f"{item['nombre']} {item['categoria']} {item['subcategoria']}".lower()
            palabras_catalogo.update(w for w in re.findall(r'[a-záéíóúñ]+', texto_cat) if len(w) > 3)

        es_sobre_tienda = bool(tokens & (palabras_moda | palabras_catalogo))

        if not es_sobre_tienda:
            return JsonResponse({
                'ok': True,
                'respuesta': MENSAJE_FUERA_CONTEXTO,
                'productos': []
            })

        nums = [int(n) for n in re.findall(r'\b\d{3,5}\b', mensaje_usuario)]
        max_presupuesto = max(nums) if nums else None

        puntuados = []
        for item in catalogo_resumido:
            if max_presupuesto and item['precio'] > max_presupuesto:
                continue
            texto_item = f"{item['nombre']} {item['categoria']} {item['subcategoria']} {item['descripcion']}".lower()
            score = sum(2 for t in tokens if len(t) > 2 and t in texto_item)
            if any(w in tokens for w in ('frio', 'frío', 'lluvia', 'noche', 'invierno')) and any(w in texto_item for w in ('sudadera', 'chamarra', 'abrigo', 'hoodie', 'sueter')):
                score += 4
            if any(w in tokens for w in ('casual', 'diario', 'escuela', 'universidad', 'salir')) and any(w in texto_item for w in ('playera', 'jeans', 'sudadera', 'cargo', 'tenis')):
                score += 3
            puntuados.append((score, item))

        puntuados.sort(key=lambda x: x[0], reverse=True)
        seleccion = [x[1] for x in puntuados[:3]] if puntuados else catalogo_resumido[:3]
        ids_recomendados = [x['id'] for x in seleccion]

        nombres = ", ".join(x['nombre'] for x in seleccion)
        total = sum(x['precio'] for x in seleccion)
        respuesta_texto = (
            f"Para lo que buscas, armé esta selección disponible ahora mismo en **VÉRTICE**: **{nombres}**. "
            f"Combinan entre sí con un estilo limpio y versátil (total estimado del look: **${total:,.2f} MXN**). "
            f"Puedes abrir cualquiera para probarlo en el **Virtual Try-On** o añadirlo directo a tu bolsa."
        )

    prendas_finales = [mapa_productos[pid] for pid in ids_recomendados[:3]] if not fuera_de_tema else []

    return JsonResponse({
        'ok': True,
        'respuesta': respuesta_texto,
        'productos': prendas_finales
    })