let currentSlide = 0;
let autoSlideInterval;

const slides = document.querySelectorAll('.carousel img');

function showSlide(index) {
    slides.forEach((slide, i) => {
        slide.classList.toggle('active', i === index);
    });
}

function nextSlide() {
    currentSlide = (currentSlide + 1) % slides.length;
    showSlide(currentSlide);
}

function prevSlide() {
    currentSlide = (currentSlide - 1 + slides.length) % slides.length;
    showSlide(currentSlide);
}

function startAutoSlide() {
    autoSlideInterval = setInterval(nextSlide, 5000);
}

function stopAutoSlide() {
    clearInterval(autoSlideInterval);
}

document.querySelector('.carousel').addEventListener('mouseover', stopAutoSlide);
document.querySelector('.carousel').addEventListener('mouseout', startAutoSlide);

showSlide(currentSlide);
startAutoSlide();