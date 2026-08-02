const button = document.getElementById("headlineButton");
const page = document.getElementById("page");

button.addEventListener("click", () => {

    const headline = document.createElement("h1");

    headline.innerText = "Your Headline";

    headline.style.position = "absolute";
    headline.style.left = "50px";
    headline.style.top = "50px";

    page.appendChild(headline);

});
