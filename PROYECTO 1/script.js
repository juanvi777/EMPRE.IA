alert ("bienvenido a mi primera pagina web")
console.log("hola, soy juan")
function saludar(){
    alert("gracias por visitar mi pagina web")
}
function preguntarnombre(){
let nombre = prompt("¿cual es tu nombre?")
alert("hola " + nombre + ", gracias por visitar mi pagina web")
if (nombre !== null && nombre !== "") {
    alert("mucho gusto" + nombre + ", espero que disfrutes tu visita a mi pagina web")
}
}
