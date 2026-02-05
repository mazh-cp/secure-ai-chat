# Update GitHub repo (mazh-cp/secure-ai-chat)

Your local **v1.0.12** release is committed and tagged. To update the GitHub repo, run these commands in **Terminal.app** or **iTerm** (not Cursor’s terminal, so Git can use your credentials).

## 1. Push the branch

```bash
cd "/Users/mhamayun/Downloads/Cursor Workbooks/Secure-Ai-Chat-V1.0.1/secure-ai-chat"
git push origin restore-local-stability
```

## 2. Push the tag

```bash
git push origin v1.0.12
```

## 3. (Optional) Merge into main and push

If you want **main** on GitHub to include v1.0.12:

```bash
git checkout main
git pull origin main
git merge restore-local-stability -m "Merge v1.0.12: Anthropic support, local start, RAG, docs"
git push origin main
```

## If push asks for credentials

- **HTTPS**: Use your GitHub username and a [Personal Access Token](https://github.com/settings/tokens) (not your password) when prompted. To save it: `git config --global credential.helper osxkeychain`
- **SSH**: Use SSH instead so push uses your SSH key:
  ```bash
  git remote set-url origin git@github.com:mazh-cp/secure-ai-chat.git
  git push origin restore-local-stability
  git push origin v1.0.12
  ```
  Ensure your SSH key is added in GitHub: **Settings → SSH and GPG keys**. If you don’t have a key: `ssh-keygen -t ed25519 -C "your_email@example.com" -f ~/.ssh/id_ed25519 -N ""`, then add `~/.ssh/id_ed25519.pub` to GitHub.

Repo: **https://github.com/mazh-cp/secure-ai-chat**
