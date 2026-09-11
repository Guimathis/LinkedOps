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
from datetime import datetime, timezone

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

def inject_frontmatter_metadata(raw_content: str, fields: dict) -> str:
    """Injeta ou substitui metadados no bloco YAML Frontmatter."""
    match = re.match(r"^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$", raw_content)
    if not match:
        raise ValueError("Delimitadores de Frontmatter ('---') não encontrados para injeção.")

    frontmatter, body = match.group(1), match.group(2)
    for key, val in fields.items():
        formatted_val = f'"{val}"' if isinstance(val, str) else str(val)
        pattern = re.compile(rf"^{key}:.*$", re.MULTILINE)
        if pattern.search(frontmatter):
            frontmatter = pattern.sub(f"{key}: {formatted_val}", frontmatter)
        else:
            frontmatter = f"{frontmatter.rstrip()}\n{key}: {formatted_val}"

    return f"---\n{frontmatter.strip()}\n---\n\n{body.strip()}\n"

def archive_published_post(file_path: Path, post_urn: str, metadata: dict, content_hash: str, published_at: str = None) -> Path:
    """Move arquivo para posts/published/, atualiza frontmatter e history.json."""
    if published_at is None:
        published_at = datetime.now(timezone.utc).isoformat()

    resolved_path = file_path.resolve()
    published_dir = PROJECT_ROOT / "posts" / "published"
    published_dir.mkdir(parents=True, exist_ok=True)

    destination_path = published_dir / resolved_path.name
    with open(resolved_path, "r", encoding="utf-8") as f:
        raw_content = f.read()

    enriched = inject_frontmatter_metadata(raw_content, {
        "published_at": published_at,
        "linkedin_post_urn": post_urn
    })

    with open(destination_path, "w", encoding="utf-8") as f:
        f.write(enriched)

    if resolved_path != destination_path and resolved_path.exists():
        resolved_path.unlink()

    # Atualiza history.json
    history_path = PROJECT_ROOT / "history.json"
    history = []
    if history_path.exists():
        try:
            with open(history_path, "r", encoding="utf-8") as f:
                history = json.load(f)
            if not isinstance(history, list):
                history = []
        except Exception:
            history = []

    already_logged = any(item.get("linkedin_urn") == post_urn or item.get("content_hash") == content_hash for item in history)
    if not already_logged:
        history.append({
            "file_path": str(destination_path.relative_to(PROJECT_ROOT)).replace("\\", "/"),
            "title": metadata.get("title"),
            "content_hash": content_hash,
            "linkedin_urn": post_urn,
            "published_at": published_at,
            "media_attached": bool(metadata.get("media"))
        })
        with open(history_path, "w", encoding="utf-8") as f:
            json.dump(history, f, indent=2, ensure_ascii=False)
            f.write("\n")

    return destination_path

def validate_post(file_path: Path, metadata: dict, content_hash: str = None):
    """Valida duplicatas, histórico de publicação e integridade dos assets."""
    urn = metadata.get("linkedin_post_urn")
    if urn:
        return False, f"Arquivo já possui 'linkedin_post_urn' ({urn}). Ignorando para evitar duplicatas."

    if content_hash:
        history_path = PROJECT_ROOT / "history.json"
        if history_path.exists():
            try:
                with open(history_path, "r", encoding="utf-8") as f:
                    history = json.load(f)
                if isinstance(history, list):
                    for item in history:
                        if item.get("content_hash") == content_hash:
                            return False, f"Conteúdo já publicado anteriormente ({item.get('linkedin_urn')}). Ignorando por idempotência."
            except Exception:
                pass

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

def process_post_file(file_path: Path, is_dry_run: bool = False):
    """Processa um arquivo individual de post."""
    resolved_path = file_path.resolve()
    if not resolved_path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {resolved_path}")

    print(f"\n📄 Processando arquivo: {resolved_path.relative_to(PROJECT_ROOT)}")
    with open(resolved_path, "r", encoding="utf-8") as f:
        content = f.read()

    metadata, body = parse_frontmatter(content)
    formatted = format_content(metadata, body)
    content_hash = calculate_content_hash(formatted["commentary"])

    is_valid, reason = validate_post(resolved_path, metadata, content_hash)
    if not is_valid:
        print(f"⚠️  [AVISO] {reason}")
        return {"skipped": True, "reason": reason}

    print(f"📌 Título: \"{formatted['title']}\"")
    print(f"🔒 Visibilidade: {formatted['visibility']}")
    print(f"📏 Contagem de caracteres: {formatted['char_count']} / 3.000")
    if formatted["media"]:
        print(f"🖼️  Mídia referenciada: {formatted['media']} (validada fisicamente)")
    print(f"🔑 SHA-256: {content_hash[:16]}...")

    if is_dry_run:
        print("\n--- [MODO DRY-RUN: CONTEÚDO FINAL DO POST] ---")
        print(formatted["commentary"])
        print("----------------------------------------------")
        print("✅ Dry-run concluído com sucesso. Nenhuma requisição externa foi realizada.\n")
        return {"success": True, "dry_run": True}

    print("\n🚀 Publicando no LinkedIn...")
    urn = publish_to_linkedin(formatted)
    print(f"🎉 Sucesso! Post publicado com URN: {urn}")

    # Ciclo de vida automático (Fase 3): enriquece frontmatter, move arquivo e atualiza history.json
    archived_path = archive_published_post(resolved_path, urn, metadata, content_hash)
    print(f"📦 Post arquivado com sucesso em: {archived_path.relative_to(PROJECT_ROOT)}")
    print("📝 Log de publicação registrado em history.json\n")

    return {"success": True, "urn": urn, "archived_path": archived_path}

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

    target_files = []
    if args.file:
        target_files = [Path(args.file)]
    else:
        queue_dir = PROJECT_ROOT / "posts" / "queue"
        if queue_dir.exists():
            target_files = sorted(list(queue_dir.glob("*.md")))

    if not target_files:
        print("ℹ️  Nenhum post pendente encontrado para processar.")
        return

    print(f"🎯 Encontrado(s) {len(target_files)} arquivo(s) para processamento.")
    has_errors = False
    for fpath in target_files:
        try:
            process_post_file(fpath, is_dry_run=args.dry_run)
        except Exception as exc:
            print(f"❌ [ERRO AO PROCESSAR {fpath.name}] {exc}", file=sys.stderr)
            has_errors = True

    if has_errors:
        sys.exit(1)

if __name__ == "__main__":
    main()
