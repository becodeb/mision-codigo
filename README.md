# Misión Código

Material para una clase de programación con bloques de una hora, para primaria. Está hecho con [Blockly](https://developers.google.com/blockly), la misma librería en la que se basan Scratch y Code.org.

Cada versión es un único archivo HTML. Se abre con doble clic en cualquier navegador y no necesita instalación ni cuentas. Hace falta internet solo para cargar Blockly y las tipografías.

## Estudio de Historias (`estudio/`), versión principal

Funciona como un taller guiado al estilo Scratch: cada chico arma su propia escena, historieta o juego. Robi, un robot guía, acompaña paso a paso. No hay una respuesta correcta.

- **Modo fácil (1.º y 2.º grado):** bloques con dibujos y voz. Los chicos eligen el lugar y el personaje, lo hacen hablar con frases ya armadas, moverse, cambiar de cara y sonar. Después suman un amigo, hacen que hablen por turnos y preparan una sorpresa que aparece al tocar al personaje. Los bloques nuevos aparecen a medida que avanza la guía, y el botón «Mostrame» enseña con una mano animada dónde va cada bloque.
- **Modo creador (3.º a 5.º grado):** bloques como los de Scratch, organizados en Eventos, Movimiento, Apariencia, Sonido, Control y Puntos. Permite diálogos escritos por los chicos, mensajes entre personajes, control con el teclado, «por siempre», «si tocando…», puntos y cambios de escenario. Cada paso trae un ejemplo para mirar.
- Hay 6 personajes con 6 emociones cada uno y 6 escenarios. Los personajes se arrastran en el escenario para ubicarlos.
- El botón «Mostrar» abre la historia en pantalla completa para presentarla a la clase.
- El progreso se guarda en el navegador de cada compu (`localStorage`).

Para usarla, abrí `estudio/index.html`.

## Misión Código: niveles (`niveles/`), primera versión

Desafíos con solución única, al estilo Code.org. Tiene dos mundos:

- **Mundo Michi:** secuencias, saltos y repetir, pensado para chicos que todavía no leen.
- **Base Estelar:** bucles, condicionales y bucles anidados, con límite de bloques.

Quedó como material complementario. Para usarla, abrí `niveles/index.html`.

## Archivos

| Carpeta | `index.html` | Otro archivo |
| --- | --- | --- |
| `estudio/` | Página completa para abrir local o publicar | `estudio.html`: el mismo contenido sin `<head>`, usado para publicarlo como Artifact |
| `niveles/` | Página completa para abrir local o publicar | `niveles.html`: el mismo contenido sin `<head>` |
