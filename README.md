# AparcAPP — Versión 2
Actulización de la versión 1 con una nueva interfaz y mejora en todas las funcionalidades.  
Sistema básico para gestionar y visualizar plazas de aparcamiento en tiempo real.

Incluye:
- API REST con FastAPI  
- WebSockets para actualizaciones en vivo  
- Base de datos SQLite  
- Frontend simple (HTML + CSS + JS)  
- Compatibilidad total con Python 3.13 (Pydantic v2 + SQLModel 0.0.16)

---

## Tecnologías utilizadas

### Backend
- FastAPI >= 0.110  
- SQLModel >= 0.0.16  
- Pydantic >= 2.6  
- Hypercorn  
- SQLite  

### Frontend
- HTML  
- CSS  
- JavaScript (fetch + WebSocket)

---

## Requisitos previos

- **Python 3.13**  
- Git instalado  
- Navegador web moderno

---

## Estructura del proyecto

```
proyecto/
│
├── backend/
│   ├── main.py
│   ├── models.py
│   ├── requirements.txt
│   ├── spots.db   (opcional)
│
├── fronted/
│   ├── index.html
│   ├── style.css
│   ├── app.js
│
├── .gitignore
└── README.md
```


---

##  Instalación del backend

### 1.-Crear entorno virtual

```
cd C:\proyecto\backend> 
```

```
python -m venv venv
```

### 2.-Activar entorno virtual 

### En C:\proyecto\backend>
```
.\venv\Scripts\Activate.ps1

``` 
### 3.-Instalar dependencias

### Desde (venv) C:\proyecto\backend>

``` 
pip install -r requirements.txt

``` 

### 4.-Activar Backend

### Desde (venv) C:\proyecto\backend>

``` 
hypercorn main:app --reload

``` 


### 5.-Ejecutar el frontend
### Desde la carpeta raíz del proyecto:

```
PS C:\proyecto> cd .\fronted\
PS C:\proyecto\fronted> python -m http.server 5500

```

### Ya puedes acceder a la aplicación

![alt text](app.png)