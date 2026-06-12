# GitHub Pages setup for dashuiobd.com

## Repository files
Place these files in the root of your GitHub Pages repository:

- index.html
- editor.html
- downloads.html
- contact.html
- privacy.html
- CNAME

The CNAME file must contain exactly:

```text
dashuiobd.com
```

## Git commands
From your local repository folder:

```powershell
git add index.html editor.html downloads.html contact.html privacy.html CNAME github-pages-setup.md
git commit -m "Configure site for dashuiobd.com"
git push
```

## GitHub Pages settings
Go to:

Repository -> Settings -> Pages -> Custom domain

Set the custom domain to:

```text
dashuiobd.com
```

## DNS records
At your domain registrar / DNS provider, configure:

```text
A      @      185.199.108.153
A      @      185.199.109.153
A      @      185.199.110.153
A      @      185.199.111.153
CNAME  www    myselfmike.github.io
```

After GitHub says DNS is valid, enable Enforce HTTPS.
