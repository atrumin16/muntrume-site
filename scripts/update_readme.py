#!/usr/bin/env python3
import requests
import json
import re
from datetime import datetime
from dateutil import parser

# Configuración
README_PATH = 'README.md'
WORKER_URL = 'https://muntrume.atrumin16.workers.dev'
DISCORD_WIDGET_URL = 'https://discord.com/api/guilds/1188239582865661992/widget.json'

def fetch_news():
    """Obtiene las últimas noticias del worker"""
    try:
        response = requests.post(WORKER_URL, 
            json={'mode': 'fetch_all_news'},
            timeout=10
        )
        if response.status_code == 200:
            data = response.json()
            return data.get('items', [])[:5]  # Top 5 noticias
    except Exception as e:
        print(f"Error fetching news: {e}")
    return []

def fetch_discord_stats():
    """Obtiene estadísticas de Discord"""
    try:
        response = requests.get(DISCORD_WIDGET_URL, timeout=5)
        if response.status_code == 200:
            data = response.json()
            return {
                'members': len(data.get('members', [])),
                'online': data.get('presence_count', 0)
            }
    except Exception as e:
        print(f"Error fetching Discord stats: {e}")
    return {'members': 0, 'online': 0}

def format_news_section(news_items):
    """Formatea la sección de noticias"""
    if not news_items:
        return "No news available at the moment."
    
    lines = ["**📰 Top Stories from The Muntrume Daily:**\n"]
    for i, item in enumerate(news_items[:5], 1):
        title = item.get('title', 'Untitled')
        link = item.get('link', '#')
        source = item.get('source', 'Unknown')
        lines.append(f"{i}. [{title}]({link}) — *{source}*")
    
    lines.append(f"\n[👉 Read more at The Muntrume Daily](https://muntru.me/news.html)")
    return '\n'.join(lines)

def update_section(content, section_name, new_content):
    """Actualiza una sección específica del README"""
    pattern = rf'<!-- {section_name}_START -->.*?<!-- {section_name}_END -->'
    replacement = f'<!-- {section_name}_START -->\n{new_content}\n<!-- {section_name}_END -->'
    return re.sub(pattern, replacement, content, flags=re.DOTALL)

def main():
    print("🔄 Updating README...")
    
    # Leer README actual
    with open(README_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Actualizar timestamp
    timestamp = datetime.now().strftime('%Y-%m-%d %H:%M UTC')
    content = update_section(content, 'UPDATE_TIMESTAMP', timestamp)
    
    # Actualizar noticias
    print("📰 Fetching latest news...")
    news = fetch_news()
    news_section = format_news_section(news)
    content = update_section(content, 'NEWS', news_section)
    
    # Actualizar stats de Discord
    print("💬 Fetching Discord stats...")
    discord_stats = fetch_discord_stats()
    discord_section = f"- 👥 Members: **{discord_stats['members']}**\n- 🟢 Online: **{discord_stats['online']}**"
    content = update_section(content, 'DISCORD_STATS', discord_section)
    
    # Guardar README actualizado
    with open(README_PATH, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("✅ README updated successfully!")

if __name__ == '__main__':
    main()
