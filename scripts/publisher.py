#!/usr/bin/env python3
"""
LinkedIn Content as Code — Publisher Script (Python)
Parsing, formatação e publicação na LinkedIn REST API.
"""

import os
import sys
import re
import json
import hashlib
import argparse
from pathlib import Path
import urllib.request
import urllib.error

PROJECT_ROOT = Path(__file__).resolve().parent.parent

def load_env():
    """Carregador simples de .env sem dependências externas obrigatórias."""
    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    k, v = line.split("=", 1)
                    k = k.strip()
                    v = v.strip().strip("'\"")
                    if k not in os.environ:
                        os.environ[k] = v

load_env()

def parse_frontmatter(content: str):
    """Extrai YAML Frontmatter e o corpo do arquivo Markdown."""
    match = re.match(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$", content)
    if not match:
        raise ValueError("Arquivo Markdown inválido: delimitadores de Frontmatter ('---') não encontrados.")

    raw_yaml, body = match.group(1), match.group(2).strip()
    metadata = {}
    current_key = None

    for line in raw_yaml.splitlines():
        trimmed = line.strip()
        if not trimmed or trimmed.startswith("#"):
            continue

        if trimmed.startswith("- ") and current_key:
            if not isinstance(metadata[current_key], list):
                metadata[current_key] = []
            item = trimmed[2:].strip().strip("'\"")
            metadata[current_key].append(item)
            continue

        if ":" in trimmed:
            key, val = trimmed.split(":", 1)
            key = key.strip()
            val = val.strip()
            if not val:
                current_key = key
                metadata[key] = []
            else:
                current_key = None
                metadata[key] = val.strip("'\"")

    return metadata, body

def format_content(metadata: dict, body: str):
    """
    Aplica as transformações para o LinkedIn:
    - Bullets Unicode (•) para listas
    - Link canônico
    - Hashtags a partir de tags
    - Validação de 3.000 caracteres
    """
    title = metadata.get("title")
    if not title:
        raise ValueError("Campo obrigatório 'title' ausente no Frontmatter.")

    # 1. Transformação de marcadores de lista (- ou *) para bullets Unicode (•)
    formatted_lines = []
    for line in body.splitlines():
        bullet_match = re.match(r"^(\s*)[-*]\s+(.*)$", line)
        if bullet_match:
            formatted_lines.append(f"{bullet_match.group(1)}• {bullet_match.group(2)}")
        else:
            formatted_lines.append(line)
    formatted_body = "\n".join(formatted_lines)

    # 2. Canonical URL se fornecido
    canonical_url = metadata.get("canonical_url")
    if canonical_url and canonical_url not in formatted_body:
        formatted_body += f"\n\n🔗 Link de referência:\n{canonical_url}"

    # 3. Tags convertidas em hashtags
    tags = metadata.get("tags")
    if isinstance(tags, list) and tags:
        hashtags = [f"#{tag.lstrip('#').strip()}" for tag in tags if tag.strip()]
        if hashtags:
            formatted_body += f"\n\n{' '.join(hashtags)}"

    char_count = len(formatted_body)
    if char_count > 3000:
        raise ValueError(f"Publicação excede o limite de 3.000 caracteres ({char_count} caracteres).")

    return {
        "title": title,
        "visibility": metadata.get("visibility", "PUBLIC"),
        "commentary": formatted_body,
        "media": metadata.get("media"),
        "char_count": char_count
    }

def validate_post(file_path: Path, metadata: dict):
    """Valida duplicatas e integridade dos assets."""
    urn = metadata.get("linkedin_post_urn")
    if urn:
        return False, f"Arquivo já possui 'linkedin_post_urn' ({urn}). Ignorando para evitar duplicatas."

    media = metadata.get("media")
    if media:
        media_path = (PROJECT_ROOT / media).resolve()
        if not media_path.exists():
            raise FileNotFoundError(f"Arquivo de mídia não encontrado: {media}")

    return True, ""

def calculate_content_hash(text: str) -> str:
    """Gera hash SHA-256 do texto normalizado."""
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()

def publish_to_linkedin(formatted: dict):
    """Dispara a publicação via LinkedIn REST API."""
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    author_urn = os.environ.get("LINKEDIN_AUTHOR_URN")

    if not token or not author_urn:
        raise RuntimeError("Variáveis LINKEDIN_ACCESS_TOKEN e/ou LINKEDIN_AUTHOR_URN não configuradas.")

    endpoint = "https://api.linkedin.com/rest/posts"
    api_version = os.environ.get("LINKEDIN_VERSION", "202608")
    payload = {
        "author": author_urn,
        "commentary": formatted["commentary"],
        "visibility": "CONNECTIONS" if formatted["visibility"] == "CONNECTIONS" else "PUBLIC",
        "distribution": {
            "feedDistribution": "MAIN_FEED",
            "targetEntities": [],
            "thirdPartyDistributionChannels": []
        },
        "lifecycleState": "PUBLISHED",
        "isReshareDisabledByAuthor": False
    }

    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {token}",
            "LinkedIn-Version": api_version,
            "X-Restli-Protocol-Version": "2.0.0",
            "Content-Type": "application/json"
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req) as resp:
            post_urn = resp.headers.get("x-restli-id") or resp.headers.get("x-linkedin-id") or "URN_CREATED"
            return post_urn
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8")
        raise RuntimeError(f"Erro na API do LinkedIn [HTTP {err.code}]: {body}")

def get_profile_info():
    """Consulta dados da conta associada ao LINKEDIN_ACCESS_TOKEN."""
    token = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    if not token:
        raise RuntimeError("Variável LINKEDIN_ACCESS_TOKEN não configurada no .env.")

    req = urllib.request.Request(
        "https://api.linkedin.com/v2/userinfo",
        headers={"Authorization": f"Bearer {token}"}
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))

def main():
    parser = argparse.ArgumentParser(description="LinkedIn Content as Code Publisher")
    parser.add_argument("file", nargs="?", help="Caminho do arquivo Markdown a ser publicado")
    parser.add_argument("--dry-run", action="store_true", help="Simula o processamento sem disparar a API")
    parser.add_argument("--whoami", action="store_true", help="Inspeciona o token e exibe o ID de autor (sub)")
    args = parser.parse_args()

    if args.whoami:
        print("\n🔍 Consultando perfil associado ao LINKEDIN_ACCESS_TOKEN...")
        try:
            info = get_profile_info()
            name = info.get("name") or f"{info.get('given_name', '')} {info.get('family_name', '')}".strip()
            print(f"👤 Nome: {name}")
            if "email" in info:
                print(f"📧 Email: {info['email']}")
            print(f"🆔 ID de Usuário (sub): {info['sub']}")
            print("\n💡 Dica de configuração:")
            print(f"Para postar no seu Perfil Pessoal, configure no .env:")
            print(f'LINKEDIN_AUTHOR_URN="urn:li:person:{info["sub"]}"\n')
            return
        except Exception as exc:
            print(f"❌ [ERRO AO CONSULTAR PERFIL] {exc}", file=sys.stderr)
            sys.exit(1)

    target_file = args.file
    if not target_file:
        queue_dir = PROJECT_ROOT / "posts" / "queue"
        if queue_dir.exists():
            candidates = sorted(list(queue_dir.glob("*.md")))
            if candidates:
                target_file = str(candidates[0])

    if not target_file:
        print("Uso: python scripts/publisher.py [caminho/do/post.md] [--dry-run]")
        print("Nenhum arquivo especificado e nenhum arquivo .md encontrado em posts/queue/.")
        sys.exit(1)

    file_path = Path(target_file).resolve()
    if not file_path.exists():
        print(f"[ERRO] Arquivo não encontrado: {file_path}", file=sys.stderr)
        sys.exit(1)

    print(f"\n📄 Processando arquivo: {file_path.relative_to(PROJECT_ROOT)}")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    metadata, body = parse_frontmatter(content)
    is_valid, reason = validate_post(file_path, metadata)
    if not is_valid:
        print(f"⚠️  [AVISO] {reason}")
        sys.exit(0)

    formatted = format_content(metadata, body)
    content_hash = calculate_content_hash(formatted["commentary"])

    print(f"📌 Título: \"{formatted['title']}\"")
    print(f"🔒 Visibilidade: {formatted['visibility']}")
    print(f"📏 Contagem de caracteres: {formatted['char_count']} / 3.000")
    if formatted["media"]:
        print(f"🖼️  Mídia referenciada: {formatted['media']} (validada fisicamente)")
    print(f"🔑 SHA-256: {content_hash[:16]}...")

    if args.dry_run:
        print("\n--- [MODO DRY-RUN: CONTEÚDO FINAL DO POST] ---")
        print(formatted["commentary"])
        print("----------------------------------------------")
        print("✅ Dry-run concluído com sucesso. Nenhuma requisição externa foi realizada.\n")
        sys.exit(0)

    print("\n🚀 Publicando no LinkedIn...")
    try:
        urn = publish_to_linkedin(formatted)
        print(f"🎉 Sucesso! Post publicado com URN: {urn}")
    except Exception as exc:
        print(f"❌ [ERRO AO PUBLICAR] {exc}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
