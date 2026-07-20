# Deploy on Google Cloud (e2-micro)

Run the app on a small always-on VM in GCP’s **Always Free** tier. The VM keeps SQLite on a persistent disk, runs the built-in scheduler 24/7, and serves HTTPS via Caddy.

## What you need before starting

1. A **GCP project** with billing enabled (free tier still requires billing on file).
2. A **hostname** pointing at the VM’s external IP (a subdomain you own, or a free DuckDNS name). HTTPS requires a name, not a raw IP.
3. Secrets ready:
   - `GOOGLE_MAPS_API_KEY` (Routes API enabled; restrict to the VM’s **external IP**)
   - `SITE_PASSWORD` (browser login)
   - `CRON_SECRET` (long random string; optional if you only use the built-in scheduler)

## Part 1 — Create the VM (GCP Console)

1. Open [Compute Engine → VM instances](https://console.cloud.google.com/compute/instances).
2. **Create instance**
   - Name: `drive-time-tracker`
   - Region: **`us-west1`**, **`us-central1`**, or **`us-east1`** (Always Free eligible)
   - Machine type: **e2-micro**
   - Boot disk: **Debian 12** or **Ubuntu 22.04**, 30 GB standard persistent disk
   - Firewall: check **Allow HTTP traffic** and **Allow HTTPS traffic**
3. Click **Create**.
4. Note the **External IP** (e.g. `34.x.x.x`).

## Part 2 — DNS

Point a hostname at that IP:

```
commute.yourdomain.com  →  A record  →  34.x.x.x
```

Or use [DuckDNS](https://www.duckdns.org/) (free): `yourname.duckdns.org` → your IP.

Wait a few minutes for DNS to propagate.

## Part 3 — SSH into the VM

In the console, click **SSH** next to the instance, or from your PC:

```bash
gcloud compute ssh drive-time-tracker --zone=us-west1-b
```

(Adjust zone to match what you chose.)

## Part 4 — Run setup script

On the VM:

```bash
git clone https://github.com/maleen89/drive-time-tracker.git /tmp/drive-time-tracker
cd /tmp/drive-time-tracker
sudo DOMAIN=commute.yourdomain.com bash deploy/gce/setup-vm.sh
```

Replace `commute.yourdomain.com` with your hostname.

## Part 5 — Configure secrets

```bash
sudo nano /etc/drive-time-tracker.env
```

Set at minimum:

- `GOOGLE_MAPS_API_KEY`
- `SITE_PASSWORD`
- `CRON_SECRET`
- Confirm `DATABASE_URL=file:/var/lib/drive-time-tracker/data/dev.db`

Save and exit.

## Part 6 — Build and start

```bash
sudo bash /opt/drive-time-tracker/deploy/gce/update-app.sh
```

Initialize the database (first time only):

```bash
sudo -u dtt bash -lc 'cd /opt/drive-time-tracker && npm run db:push'
```

## Part 7 — Copy your existing data (optional)

From your **PC** (if you want to keep locations, pairs, and history):

```powershell
scp C:\Users\Maleen\Projects\drive-time-tracker\prisma\dev.db `
  YOUR_USERNAME@EXTERNAL_IP:/tmp/dev.db
```

On the VM:

```bash
sudo mv /tmp/dev.db /var/lib/drive-time-tracker/data/dev.db
sudo chown dtt:dtt /var/lib/drive-time-tracker/data/dev.db
sudo systemctl restart drive-time-tracker
```

## Part 8 — Google API key

In [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials):

1. Edit your API key.
2. Under **Application restrictions**, choose **IP addresses** and add the VM **external IP**.
3. Under **API restrictions**, allow **Routes API**.

## Part 9 — Verify

1. Open `https://commute.yourdomain.com` — browser asks for username/password (Basic Auth). Username can be anything; **password** is `SITE_PASSWORD`.
2. Dashboard should show **Built-in scheduler on**.
3. Check logs: `journalctl -u drive-time-tracker -f`
4. After the next slot window, confirm new rows appear in History.

## Updating the app later

On the VM:

```bash
sudo bash /opt/drive-time-tracker/deploy/gce/update-app.sh
```

## Firewall note

If HTTPS fails, add a VPC firewall rule allowing **tcp:443** and **tcp:80** to instances with network tag `http-server` / `https-server`, or use the console checkboxes on the VM.

## Cost

e2-micro + 30 GB disk in an Always Free region is **$0/month** within [free tier limits](https://cloud.google.com/free/docs/free-cloud-features#compute). No Cloud SQL or Cloud Run required.

## Optional: Cloud Scheduler backup

If you ever disable the built-in scheduler, create a [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler) job:

- Frequency: `*/5 * * * *`
- Target: `POST https://commute.yourdomain.com/api/cron/run`
- Header: `Authorization: Bearer YOUR_CRON_SECRET`

`/api/cron/run` is **not** protected by `SITE_PASSWORD`; it uses `CRON_SECRET` only.
