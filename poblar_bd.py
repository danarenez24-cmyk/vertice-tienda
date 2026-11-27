from db_mongo import db

# 1. Vaciar la colección por completo para no dejar ningún registro con personas
db.Productos.drop()

# URLs verificadas exclusivamente de prendas (en gancho, plano o dobladas)
IMG_CHAMARRA = "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=80"
IMG_PLAYERA_NEGRA = "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=800&q=80"
IMG_PLAYERA_BLANCA = "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?auto=format&fit=crop&w=800&q=80"
IMG_SUDADERA = "https://images.unsplash.com/photo-1556905055-8f358a7a47b2?auto=format&fit=crop&w=800&q=80"
IMG_PANTALON = "https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?auto=format&fit=crop&w=800&q=80"
IMG_CAMISA = "https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?auto=format&fit=crop&w=800&q=80"
IMG_JEANS = "https://images.unsplash.com/photo-1541099649105-f69ad21f3246?auto=format&fit=crop&w=800&q=80"
IMG_CHAQUETA_DENIM = "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?auto=format&fit=crop&w=800&q=80"
IMG_VESTIDO = "https://images.unsplash.com/photo-1585487000160-6ebcfceb0d03?auto=format&fit=crop&w=800&q=80"
IMG_FALDA = "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=800&q=80"
IMG_BLUSA = "https://images.unsplash.com/photo-1604014237800-1c9102c219da?auto=format&fit=crop&w=800&q=80"
IMG_TOP = "https://images.unsplash.com/photo-1562157873-818bc0726f68?auto=format&fit=crop&w=800&q=80"
IMG_SACO = "https://images.unsplash.com/photo-1598033129183-c4f50c736f10?auto=format&fit=crop&w=800&q=80"
IMG_KIDS_JACKET = "https://images.unsplash.com/photo-1622290291468-a28f7a7dc6a8?auto=format&fit=crop&w=800&q=80"
IMG_KIDS_DRESS = "https://images.unsplash.com/photo-1621452773781-0f992fd1f5cb?auto=format&fit=crop&w=800&q=80"

productos_demo = [
    # el
    {
        "nombre": "Chamarra de Piel Synthetic Slim",
        "precio": 999.00,
        "precio_original": 1299.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Chamarra de corte ajustado en acabado mate con cierres metálicos de alta calidad.",
        "tallas": ["S", "M", "L", "XL"],
        "colores": ["Negro", "Café"],
        "stock": {"S": 8, "M": 12, "L": 10, "XL": 4},
        "imagen": IMG_CHAMARRA,
        "imagen_url": IMG_CHAMARRA
    },
    {
        "nombre": "Playera Oversized Minimalist",
        "precio": 399.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Playera de algodón pesado con caída relajada y cuello acanalado.",
        "tallas": ["M", "L", "XL"],
        "colores": ["Blanco", "Negro", "Gris"],
        "stock": {"M": 15, "L": 20, "XL": 10},
        "imagen": IMG_PLAYERA_NEGRA,
        "imagen_url": IMG_PLAYERA_NEGRA
    },
    {
        "nombre": "Sudadera Hoodie Essential Black",
        "precio": 649.00,
        "precio_original": 799.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Sudadera con capucha, felpa interior térmica y bolsillo tipo canguro.",
        "tallas": ["S", "M", "L", "XL"],
        "colores": ["Negro"],
        "stock": {"S": 6, "M": 14, "L": 12, "XL": 5},
        "imagen": IMG_SUDADERA,
        "imagen_url": IMG_SUDADERA
    },
    {
        "nombre": "Pantalón Cargo Táctico Modern",
        "precio": 799.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Pantalón cargo de gabardina con múltiples bolsillos y ajuste elástico en tobillos.",
        "tallas": ["28", "30", "32", "34"],
        "colores": ["Verde Olivo", "Negro"],
        "stock": {"28": 5, "30": 10, "32": 8, "34": 4},
        "imagen": IMG_PANTALON,
        "imagen_url": IMG_PANTALON
    },
    {
        "nombre": "Camisa de Lino Manga Larga",
        "precio": 599.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Camisa fresca de fibra de lino ideal para climas cálidos y eventos semi-formales.",
        "tallas": ["S", "M", "L"],
        "colores": ["Blanco", "Azul Cielo"],
        "stock": {"S": 7, "M": 11, "L": 9},
        "imagen": IMG_CAMISA,
        "imagen_url": IMG_CAMISA
    },
    {
        "nombre": "Jeans Slim Fit Denim Obscuro",
        "precio": 699.00,
        "precio_original": 849.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Jeans con corte ajustado de mezclilla elástica para mayor comodidad.",
        "tallas": ["30", "32", "34", "36"],
        "colores": ["Azul Marino"],
        "stock": {"30": 9, "32": 15, "34": 11, "36": 6},
        "imagen": IMG_JEANS,
        "imagen_url": IMG_JEANS
    },
    {
        "nombre": "Chaqueta Denim Vintage Unwashed",
        "precio": 899.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Chaqueta clásica de mezclilla rígida de corte estructurado urbano.",
        "tallas": ["S", "M", "L", "XL"],
        "colores": ["Azul Clásico"],
        "stock": {"S": 4, "M": 8, "L": 7, "XL": 3},
        "imagen": IMG_CHAQUETA_DENIM,
        "imagen_url": IMG_CHAQUETA_DENIM
    },
    {
        "nombre": "Chaleco Acolchado Térmico",
        "precio": 749.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Chaleco ligero repelente al agua con relleno térmico de plumón sintético.",
        "tallas": ["M", "L", "XL"],
        "colores": ["Negro", "Gris Oscuro"],
        "stock": {"M": 10, "L": 9, "XL": 6},
        "imagen": IMG_CHAMARRA,
        "imagen_url": IMG_CHAMARRA
    },
    {
        "nombre": "Pantalón Jogger Urbano Street",
        "precio": 549.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Jogger deportivo ajustado con cordón ajustable y tela respirable.",
        "tallas": ["S", "M", "L"],
        "colores": ["Gris Jaspe", "Negro"],
        "stock": {"S": 12, "M": 18, "L": 14},
        "imagen": IMG_PANTALON,
        "imagen_url": IMG_PANTALON
    },
    {
        "nombre": "Suéter Tejido Cuello Alto",
        "precio": 629.00,
        "precio_original": 759.00,
        "categoria": "el",
        "coleccion": "regular",
        "descripcion": "Suéter de tejido de punto suave con cuello tortuga elegante.",
        "tallas": ["S", "M", "L", "XL"],
        "colores": ["Beige", "Negro"],
        "stock": {"S": 6, "M": 10, "L": 8, "XL": 4},
        "imagen": IMG_SUDADERA,
        "imagen_url": IMG_SUDADERA
    },

    # ================= CATEGORÍA: ELLA =================
    {
        "nombre": "Vestido Satinado Slip Dress",
        "precio": 849.00,
        "precio_original": 1099.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Vestido midi de tirantes finos en acabado satinado suave.",
        "tallas": ["XS", "S", "M", "L"],
        "colores": ["Negro", "Champagne"],
        "stock": {"XS": 4, "S": 9, "M": 11, "L": 6},
        "imagen": IMG_VESTIDO,
        "imagen_url": IMG_VESTIDO
    },
    {
        "nombre": "Blazer Oversized Tailored",
        "precio": 1199.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Saco holgado con hombreras estructuradas y botones a juego.",
        "tallas": ["S", "M", "L"],
        "colores": ["Negro", "Crema"],
        "stock": {"S": 7, "M": 12, "L": 8},
        "imagen": IMG_SACO,
        "imagen_url": IMG_SACO
    },
    {
        "nombre": "Top Crop de Punto Acanalado",
        "precio": 299.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Blusa corta entallada de tejido elástico ideal para capas.",
        "tallas": ["XS", "S", "M"],
        "colores": ["Blanco", "Negro", "Café"],
        "stock": {"XS": 10, "S": 15, "M": 14},
        "imagen": IMG_TOP,
        "imagen_url": IMG_TOP
    },
    {
        "nombre": "Pantalón Wide Leg de Tiro Alto",
        "precio": 749.00,
        "precio_original": 899.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Pantalón de vestir pierna ancha con pinzas frontales.",
        "tallas": ["24", "26", "28", "30"],
        "colores": ["Negro", "Beige"],
        "stock": {"24": 5, "26": 10, "28": 12, "30": 6},
        "imagen": IMG_PANTALON,
        "imagen_url": IMG_PANTALON
    },
    {
        "nombre": "Falda Midi Plisada Metallic",
        "precio": 599.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Falda plisada con cintura elástica y leve brillo elegante.",
        "tallas": ["S", "M", "L"],
        "colores": ["Plata", "Dorado"],
        "stock": {"S": 6, "M": 8, "L": 5},
        "imagen": IMG_FALDA,
        "imagen_url": IMG_FALDA
    },
    {
        "nombre": "Chamarra Puffer Crop",
        "precio": 949.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Chamarra inflada corta con ajuste elástico en la cintura.",
        "tallas": ["XS", "S", "M", "L"],
        "colores": ["Negro", "Blanco Hueso"],
        "stock": {"XS": 3, "S": 8, "M": 9, "L": 4},
        "imagen": IMG_CHAMARRA,
        "imagen_url": IMG_CHAMARRA
    },
    {
        "nombre": "Jeans Mom Fit Classic High Rise",
        "precio": 649.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Jeans de corte holgado en caderas y tobillo ligeramente ajustado.",
        "tallas": ["26", "28", "30", "32"],
        "colores": ["Azul Claro"],
        "stock": {"26": 7, "28": 14, "30": 11, "32": 5},
        "imagen": IMG_JEANS,
        "imagen_url": IMG_JEANS
    },
    {
        "nombre": "Blusa Camisera de Seda Sintética",
        "precio": 499.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Blusa fluida con cuello camisero y manga larga ajustable.",
        "tallas": ["S", "M", "L"],
        "colores": ["Blanco", "Verde Esmeralda"],
        "stock": {"S": 8, "M": 10, "L": 6},
        "imagen": IMG_BLUSA,
        "imagen_url": IMG_BLUSA
    },
    {
        "nombre": "Cardigan Chunky Knitted",
        "precio": 699.00,
        "precio_original": 829.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Suéter abierto de punto grueso con botones de carey.",
        "tallas": ["S/M", "L/XL"],
        "colores": ["Marfil", "Gris"],
        "stock": {"S/M": 15, "L/XL": 10},
        "imagen": IMG_SUDADERA,
        "imagen_url": IMG_SUDADERA
    },
    {
        "nombre": "Body Asimétrico Escote Un Hombro",
        "precio": 379.00,
        "categoria": "ella",
        "coleccion": "regular",
        "descripcion": "Body entallado de tela stretch con diseño moderno a un hombro.",
        "tallas": ["XS", "S", "M"],
        "colores": ["Negro", "Rojo"],
        "stock": {"XS": 6, "S": 12, "M": 9},
        "imagen": IMG_TOP,
        "imagen_url": IMG_TOP
    },

    # ================= CATEGORÍA: NIÑOS =================
    {
        "nombre": "Conjunto Deportivo Kids Tracksuit",
        "precio": 549.00,
        "precio_original": 699.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Sudadera y jogger infantil de algodón térmico súper cómodo.",
        "tallas": ["4", "6", "8", "10", "12"],
        "colores": ["Azul Marino", "Gris"],
        "stock": {"4": 6, "6": 10, "8": 12, "10": 8, "12": 5},
        "imagen": IMG_SUDADERA,
        "imagen_url": IMG_SUDADERA
    },
    {
        "nombre": "Playera Estampada Graphic Kids",
        "precio": 249.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Playera 100% algodón suave con impresiones divertidas.",
        "tallas": ["4", "6", "8", "10"],
        "colores": ["Blanco", "Amarillo"],
        "stock": {"4": 12, "6": 15, "8": 14, "10": 9},
        "imagen": IMG_PLAYERA_BLANCA,
        "imagen_url": IMG_PLAYERA_BLANCA
    },
    {
        "nombre": "Chamarra Inflada Dinosaur Hood",
        "precio": 699.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Chamarra abrigadora con detalles divertidos en la capucha.",
        "tallas": ["4", "6", "8"],
        "colores": ["Verde", "Azul"],
        "stock": {"4": 5, "6": 8, "8": 6},
        "imagen": IMG_KIDS_JACKET,
        "imagen_url": IMG_KIDS_JACKET
    },
    {
        "nombre": "Jeans Elásticos Kids Comfort",
        "precio": 429.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Pantalón de mezclilla con pretina ajustable elástica interior.",
        "tallas": ["6", "8", "10", "12"],
        "colores": ["Azul Denim"],
        "stock": {"6": 9, "8": 11, "10": 10, "12": 7},
        "imagen": IMG_JEANS,
        "imagen_url": IMG_JEANS
    },
    {
        "nombre": "Vestido Infantil Floral Spring",
        "precio": 479.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Vestido de falda amplia con estampado floral ligero.",
        "tallas": ["4", "6", "8", "10"],
        "colores": ["Rosa Pastel"],
        "stock": {"4": 7, "6": 9, "8": 8, "10": 4},
        "imagen": IMG_KIDS_DRESS,
        "imagen_url": IMG_KIDS_DRESS
    },
    {
        "nombre": "Suéter Tejido Osito Fleece",
        "precio": 399.00,
        "precio_original": 499.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Suéter afelpado ultra suave para proteger del frío.",
        "tallas": ["4", "6", "8"],
        "colores": ["Café Claro", "Blanco"],
        "stock": {"4": 10, "6": 12, "8": 8},
        "imagen": IMG_SUDADERA,
        "imagen_url": IMG_SUDADERA
    },
    {
        "nombre": "Overol de Mezclilla Classic",
        "precio": 529.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Overol clásico infantil con tirantes ajustables y bolsa frontal.",
        "tallas": ["4", "6", "8", "10"],
        "colores": ["Azul Medio"],
        "stock": {"4": 4, "6": 7, "8": 9, "10": 5},
        "imagen": IMG_JEANS,
        "imagen_url": IMG_JEANS
    },
    {
        "nombre": "Pijama Algodón Glow in the Dark",
        "precio": 389.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Set de pijama de dos piezas con estampados que brillan en la oscuridad.",
        "tallas": ["6", "8", "10", "12"],
        "colores": ["Azul Noche"],
        "stock": {"6": 15, "8": 18, "10": 12, "12": 8},
        "imagen": IMG_PLAYERA_NEGRA,
        "imagen_url": IMG_PLAYERA_NEGRA
    },
    {
        "nombre": "Camisa Polo Kids Smart",
        "precio": 319.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Camisa tipo polo de tejido pique con cuello de punto.",
        "tallas": ["6", "8", "10", "12"],
        "colores": ["Rojo", "Blanco"],
        "stock": {"6": 8, "8": 10, "10": 9, "12": 6},
        "imagen": IMG_CAMISA,
        "imagen_url": IMG_CAMISA
    },
    {
        "nombre": "Short Deportivo Quick Dry",
        "precio": 229.00,
        "categoria": "niños",
        "coleccion": "regular",
        "descripcion": "Short ligero para actividades físicas de secado rápido.",
        "tallas": ["6", "8", "10"],
        "colores": ["Negro"],
        "stock": {"6": 14, "8": 16, "10": 11},
        "imagen": IMG_PANTALON,
        "imagen_url": IMG_PANTALON
    },

    # ================= CATEGORÍA: FIN DE AÑO =================
    {
        "nombre": "Vestido Lentejuelas Gala Gold",
        "precio": 1499.00,
        "precio_original": 1899.00,
        "categoria": "ella",
        "coleccion": "fin_año",
        "descripcion": "Vestido de noche cubierto totalmente de lentejuelas brillantes.",
        "tallas": ["XS", "S", "M", "L"],
        "colores": ["Dorado", "Negro Brioso"],
        "stock": {"XS": 3, "S": 7, "M": 8, "L": 4},
        "imagen": IMG_VESTIDO,
        "imagen_url": IMG_VESTIDO
    },
    {
        "nombre": "Saco Velvet Tuxedo Premium",
        "precio": 1899.00,
        "precio_original": 2299.00,
        "categoria": "el",
        "coleccion": "fin_año",
        "descripcion": "Saco de vestir confeccionado en terciopelo suave con solapa de satén.",
        "tallas": ["38R", "40R", "42R"],
        "colores": ["Vino Tinto", "Negro"],
        "stock": {"38R": 4, "40R": 6, "42R": 3},
        "imagen": IMG_SACO,
        "imagen_url": IMG_SACO
    },
    {
        "nombre": "Vestido Largo Terciopelo Royal",
        "precio": 1399.00,
        "categoria": "ella",
        "coleccion": "fin_año",
        "descripcion": "Vestido largo con abertura en pierna y escote cruzado en la espalda.",
        "tallas": ["S", "M", "L"],
        "colores": ["Azul Medianoche", "Verde Botella"],
        "stock": {"S": 5, "M": 9, "L": 6},
        "imagen": IMG_VESTIDO,
        "imagen_url": IMG_VESTIDO
    },
    {
        "nombre": "Abrigo Wool Blend Classic Camel",
        "precio": 1999.00,
        "precio_original": 2499.00,
        "categoria": "el",
        "coleccion": "fin_año",
        "descripcion": "Abrigo largo cruzado de lana abrigadora de corte sofisticado.",
        "tallas": ["S", "M", "L", "XL"],
        "colores": ["Camel", "Negro"],
        "stock": {"S": 3, "M": 8, "L": 7, "XL": 2},
        "imagen": IMG_CHAMARRA,
        "imagen_url": IMG_CHAMARRA
    },
    {
        "nombre": "Jumpsuit Satinado de Noche",
        "precio": 1199.00,
        "categoria": "ella",
        "coleccion": "fin_año",
        "descripcion": "Enterizo largo con cinturón de lazo y escote en V pronunciado.",
        "tallas": ["S", "M", "L"],
        "colores": ["Negro", "Plata"],
        "stock": {"S": 6, "M": 10, "L": 5},
        "imagen": IMG_VESTIDO,
        "imagen_url": IMG_VESTIDO
    },
    {
        "nombre": "Camisa de Etiqueta Cuello Paloma",
        "precio": 799.00,
        "categoria": "el",
        "coleccion": "fin_año",
        "descripcion": "Camisa formal para esmoquin con pliegues en pechera.",
        "tallas": ["15", "15.5", "16", "16.5"],
        "colores": ["Blanco Impoluto"],
        "stock": {"15": 5, "15.5": 9, "16": 8, "16.5": 4},
        "imagen": IMG_CAMISA,
        "imagen_url": IMG_CAMISA
    },
    {
        "nombre": "Ensamble Faux Fur Glamour",
        "precio": 1299.00,
        "categoria": "ella",
        "coleccion": "fin_año",
        "descripcion": "Chaqueta de piel sintética ultra suave ideal para vestidos de gala.",
        "tallas": ["S", "M", "L"],
        "colores": ["Marfil", "Negro"],
        "stock": {"S": 4, "M": 7, "L": 5},
        "imagen": IMG_CHAMARRA,
        "imagen_url": IMG_CHAMARRA
    },
    {
        "nombre": "Pantalón Slim Fit Satin Finish",
        "precio": 899.00,
        "categoria": "el",
        "coleccion": "fin_año",
        "descripcion": "Pantalón formal con sutil brillo satinado en las costuras laterales.",
        "tallas": ["30", "32", "34"],
        "colores": ["Negro"],
        "stock": {"30": 6, "32": 11, "34": 7},
        "imagen": IMG_PANTALON,
        "imagen_url": IMG_PANTALON
    },
    {
        "nombre": "Mini Vestido Brillos Metallic Shift",
        "precio": 999.00,
        "precio_original": 1249.00,
        "categoria": "ella",
        "coleccion": "fin_año",
        "descripcion": "Vestido corto de manga larga confeccionado en hilo metálico.",
        "tallas": ["XS", "S", "M"],
        "colores": ["Plata", "Rosa Gold"],
        "stock": {"XS": 4, "S": 8, "M": 7},
        "imagen": IMG_VESTIDO,
        "imagen_url": IMG_VESTIDO
    },
    {
        "nombre": "Moño y Cummerbund Set Seda",
        "precio": 449.00,
        "categoria": "el",
        "coleccion": "fin_año",
        "descripcion": "Set de pajarita ajustada y faja para evento de etiqueta.",
        "tallas": ["Única"],
        "colores": ["Negro", "Vino"],
        "stock": {"Única": 25},
        "imagen": IMG_SACO,
        "imagen_url": IMG_SACO
    }
]

resultado = db.Productos.insert_many(productos_demo)
print(f"¡ÉXITO! Se actualizaron {len(resultado.inserted_ids)} productos con imágenes 100% enfocadas en la prenda (sin modelos).")