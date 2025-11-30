# Manual de Administrador / Técnico
**BudgetView MoneySaver**

Este documento está diseñado para guiar a administradores y técnicos en el despliegue, configuración y mantenimiento de la aplicación, sin requerir conocimientos profundos de programación.

## 1. Requisitos del Sistema

Antes de comenzar, asegúrese de que el equipo donde se instalará la aplicación cumpla con los siguientes requisitos:

*   **Sistema Operativo:** Windows, macOS o Linux.
*   **Node.js:** Se requiere la versión 18 o superior.
    *   *Cómo verificar:* Abra una terminal y escriba `node -v`. Si no aparece una versión o es inferior a la 18, descárguelo desde [nodejs.org](https://nodejs.org/).
*   **Gestor de Paquetes (npm):** Generalmente se instala automáticamente con Node.js.
*   **Conexión a Internet:** Necesaria para descargar librerías y conectar con la base de datos.
*   **Cuenta de Supabase:** La aplicación utiliza Supabase como base de datos y sistema de autenticación. Necesitará acceso al panel de control de su proyecto en Supabase.

## 2. Cómo Desplegar la App desde Cero

Siga estos pasos para poner en marcha la aplicación en un nuevo entorno (por ejemplo, su computadora local o un servidor).

### Paso 1: Obtener el Código
Clone el repositorio.

### Paso 2: Instalar Dependencias
Las "dependencias" son librerías externas que la app necesita para funcionar.
1.  Abra la terminal (Símbolo del sistema, PowerShell o Terminal).
2.  Navegue hasta la carpeta del proyecto. Ejemplo:
    ```bash
    cd ruta/a/la/carpeta/BudgetView-MonySaver-Cheap-Version
    ```
3.  Ejecute el siguiente comando y espere a que termine:
    ```bash
    npm install
    ```

### Paso 3: Configurar Variables de Entorno
La aplicación necesita "llaves" para conectarse a la base de datos. Estas se guardan en un archivo especial.
1.  En la carpeta del proyecto, cree un nuevo archivo llamado `.env.local`.
2.  Abra este archivo con un editor de texto (Bloc de notas, VS Code, etc.).
3.  Pegue el siguiente contenido (ver sección "Variables de Entorno" para saber qué valores poner):

    ```env
    NEXT_PUBLIC_SUPABASE_URL=url del proyecto en supabase 
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY= llave publica 
    ```
4.  Guarde el archivo.

### Paso 4: Ejecutar la Aplicación
*   **Para modo desarrollo (pruebas):**
    Ejecute:
    ```bash
    npm run dev
    ```
    La app estará disponible en `http://localhost:3000`.

*   **Para modo producción (uso real):**
    Primero construya la aplicación:
    ```bash
    npm run build
    ```
    Luego iníciela:
    ```bash
    npm start
    ```
    La app estará disponible en `http://localhost:3000` (o el puerto configurado).


## 3. Variables de Entorno Necesarias

Estas variables son críticas para que la aplicación funcione. Sin ellas, no podrá iniciar sesión ni ver datos.

| Variable | Descripción | Dónde encontrarla |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | La dirección web de su base de datos en Supabase. | En Supabase: **Project Settings**>**Data API**>**Project URL**|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | La llave pública para identificar su app. | En Supabase: **Project Settings**>**Data API Keys**>**Legacy anon, service_role API keys**|

**Nota sobre Puertos:**
Por defecto, la aplicación se ejecuta en el puerto **3000**. Si necesita cambiarlo, puede hacerlo al iniciar la app (ejemplo: `PORT=4000 npm start` en Linux/Mac, o configurándolo en su proveedor de hosting).

## 4. Cómo hacer un Backup de la Base de Datos

Dado que esta aplicación utiliza **Supabase** (un servicio en la nube), las copias de seguridad se gestionan principalmente desde su plataforma.

### Backups Automáticos
Supabase realiza copias de seguridad diarias automáticamente si está en un plan Pro. En el plan gratuito, no hay backups automáticos con retención larga.