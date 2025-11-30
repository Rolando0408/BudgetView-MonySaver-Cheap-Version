# Informe de Licenciamiento
**BudgetView MoneySaver**

Este documento presenta un análisis detallado de la legalidad del proyecto, la licencia seleccionada y la compatibilidad con las librerías de terceros utilizadas.

---

## 1. Licencia del Proyecto

**Licencia Seleccionada:** [MIT License](https://opensource.org/licenses/MIT)

### Justificación
Se ha elegido la licencia MIT por ser una licencia de software libre **permisiva**. 
*   **Filosofía:** A diferencia de las licencias *copyleft* (como GPL), la licencia MIT otorga máxima libertad a los usuarios y desarrolladores. Permite usar, copiar, modificar, fusionar, publicar, distribuir, sublicenciar y vender copias del software.
*   **Compatibilidad:** Es altamente compatible con el ecosistema de JavaScript y React, donde la gran mayoría de las librerías también utilizan licencias permisivas. Esto facilita la integración sin riesgos legales de "contaminación" viral de la licencia.
*   **Adopción:** Al eliminar barreras legales complejas, fomenta una mayor adopción y contribución por parte de la comunidad.

---

## 2. Matriz de Compatibilidad

A continuación, se listan todas las dependencias externas del proyecto, sus licencias originales y su compatibilidad con nuestra licencia MIT.

| Dependencia | Versión | Licencia Original | ¿Compatible con MIT? |
| :--- | :--- | :--- | :---: |
| `@radix-ui/react-dialog` | ^1.1.15 | MIT | ✅ Sí |
| `@radix-ui/react-dropdown-menu` | ^2.1.16 | MIT | ✅ Sí |
| `@radix-ui/react-label` | ^2.1.8 | MIT | ✅ Sí |
| `@radix-ui/react-popover` | ^1.1.15 | MIT | ✅ Sí |
| `@radix-ui/react-select` | ^2.0.0 | MIT | ✅ Sí |
| `@radix-ui/react-separator` | ^1.1.8 | MIT | ✅ Sí |
| `@radix-ui/react-slot` | ^1.2.4 | MIT | ✅ Sí |
| `@supabase/supabase-js` | ^2.81.1 | MIT | ✅ Sí |
| `class-variance-authority` | ^0.7.1 | Apache 2.0 | ✅ Sí |
| `clsx` | ^2.1.1 | MIT | ✅ Sí |
| `date-fns` | ^4.1.0 | MIT | ✅ Sí |
| `lucide-react` | ^0.553.0 | ISC | ✅ Sí |
| `next` | 16.0.3 | MIT | ✅ Sí |
| `react` | 19.2.0 | MIT | ✅ Sí |
| `react-day-picker` | ^9.11.3 | MIT | ✅ Sí |
| `react-dom` | 19.2.0 | MIT | ✅ Sí |
| `recharts` | ^3.4.1 | MIT | ✅ Sí |
| `tailwind-merge` | ^3.4.0 | MIT | ✅ Sí |
| `tailwindcss` | ^4 | MIT | ✅ Sí |
| `typescript` | ^5 | Apache 2.0 | ✅ Sí |

**Conclusión de Compatibilidad:**
Todas las librerías utilizadas operan bajo licencias permisivas (MIT, ISC, Apache 2.0) que son totalmente compatibles con la licencia principal del proyecto (MIT). No existen conflictos legales conocidos en el stack actual.

---

## 3. Atribución y Créditos

Reconocemos y agradecemos el uso de los siguientes recursos gráficos y de diseño:

*   **Iconos:**
    *   [Lucide React](https://lucide.dev/): Colección de iconos open source utilizada en toda la interfaz. Licencia ISC.
*   **Componentes de UI:**
    *   [Radix UI](https://www.radix-ui.com/): Primitivas de componentes accesibles y sin estilos. Licencia MIT.
    *   [shadcn/ui](https://ui.shadcn.com/): Colección de componentes reutilizables construidos con Radix UI y Tailwind CSS.
*   **Fuentes:**
    *   El proyecto utiliza fuentes del sistema o fuentes libres compatibles con uso web.

---
*Este informe fue generado automáticamente revisando los archivos de configuración del proyecto a fecha de hoy.*
