// CONFIGURACIÓN SUPABASE (Asegúrate de cambiar la URL y KEY)
const PROJECT_URL = 'https://grxkquackoukogltscub.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyeGtxdWFja291a29nbHRzY3ViIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU5ODg4MzQsImV4cCI6MjA4MTU2NDgzNH0.GbwvrU-Si8g5-uc0mvpytqxpqOOwQM5FrlcZE6DdKk8';

const supabase = window.supabase.createClient(PROJECT_URL, ANON_KEY);

// Función que se ejecuta al cargar cualquier página
document.addEventListener('DOMContentLoaded', async () => {
    checkUserStatus();
});

async function checkUserStatus() {
    const { data: { session } } = await supabase.auth.getSession();
    
    const navList = document.querySelector('.nav-links');
    if (!navList) return; // Si no hay menú, no hacemos nada

    if (session) {
        // USUARIO LOGUEADO
        console.log("Usuario conectado:", session.user.email);
        
        // Buscar perfil para ver nombre
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

        const nombre = profile && profile.full_name ? profile.full_name : 'Piloto';

        // Añadir botón de Logout y mostrar nombre
        const li = document.createElement('li');
        li.innerHTML = `<a href="#" style="color:#00ff4c91;">👤 ${nombre}</a> 
                        <a href="#" onclick="logout()" style="font-size:0.8em; margin-left:5px;">(Salir)</a>`;
        navList.appendChild(li);
    } else {
        // USUARIO NO LOGUEADO
        const li = document.createElement('li');
        li.innerHTML = `<a href="login.html" style="border: 1px solid #00ff4c91; padding: 5px 10px; border-radius: 4px;">Login / Registro</a>`;
        navList.appendChild(li);
    }
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

if (session) {
    // ... lógica para obtener nombre ...
    const li = document.createElement('li');
    // CAMBIO: El enlace ahora lleva a profile.html
    li.innerHTML = `<a href="profile.html" style="color:#00ff4c91;">👤 ${nombre}</a>`; 
    navList.appendChild(li);
}
