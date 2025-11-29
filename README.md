<div align="center">
  <h1>BudgetView</h1>
  
  <p>
    <strong>Gestor de finanzas personales.</strong>
  </p>


  <img src="https://img.shields.io/badge/Node.js-25.x-339933?style=for-the-badge&logo=nodedotjs" alt="Node.js" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-3.x-38B2AC?style=for-the-badge&logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Supabase-DB-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase" />
  <img src="https://img.shields.io/badge/Status-Released-0fde00?style=for-the-badge" alt="Status" />
</div>

<br />

## 📋 Descripción General

**BudgetView** es una plataforma web diseñada para centralizar y simplificar la gestión de finanzas personales. Permite a los usuarios administrar sus múltiples billeteras, categorizar transacciones y visualizar el flujo de dinero en tiempo real.

El objetivo del proyecto es ofrecer una herramienta **segura, rápida y accesible** para la toma de decisiones financieras, eliminando la complejidad de las hojas de cálculo tradicionales.

---

## ✨ Características Principales

* **Gestión Multi-Billetera:** Creación y seguimiento de saldos en diferentes cuentas (Efectivo, Banco, Ahorros, etc).
* **Seguimiento en Tiempo Real:** Actualización instantánea de saldos y movimientos.
* **Categorización Inteligente:** Organización de ingresos y gastos por categorías personalizables.
* **Seguridad:** Autenticación robusta y gestión de sesiones (RLS - Row Level Security) vía Supabase Auth.
---
## 🛠 Tecnologías Utilizadas

Este proyecto sigue una arquitectura moderna y escalable:

* **Backend:** [Node.js](https://nodejs.org/)
* **Frontend / Estilos:** HTML5 + [Tailwind CSS](https://tailwindcss.com/)
* **Base de Datos & Auth:** [Supabase](https://supabase.com/) (PostgreSQL)

---

## 🚀 Instalación y Configuración

Sigue estos pasos para ejecutar el proyecto en tu entorno local.

### Prerrequisitos

* Node.js (v16 o superior)
* NPM
* Una cuenta activa en Supabase

### Pasos

1.  **Clonar el repositorio:**
    ```bash
    git clone https://github.com/Rolando0408/BudgetView-MonySaver-Cheap-Version
    cd BudgetView-MonySaver-Cheap-Version
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Configurar Variables de Entorno:**
    Crea un archivo `.env.local` en la raíz del proyecto y agrega tus credenciales de Supabase:

    ```env
    SUPABASE_URL=tu_url_de_supabase
    SUPABASE_ANON_KEY=tu_anon_key_de_supabase
    PORT=3000
    ```

4.  **Ejecutar el servidor de desarrollo:**
    ```bash
    npm run dev
    ```

5.  **Abrir en el navegador:**
    Visita `http://localhost:3000` para ver la aplicación.

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - mira el archivo [LICENSE](LICENSE) para más detalles.

---

<div align="center">
  Desarrollado por <a href="https://github.com/Rolando0408">Rolando0408</a>, <a href="https://github.com/Gbriel2003">Gbriel2003</a>, <a href="https://github.com/DS2062">DS2062</a>.
</div>
