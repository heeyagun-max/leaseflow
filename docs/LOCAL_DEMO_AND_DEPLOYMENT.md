# Local Demo and Deployment

## Supported local path

LeaseFlow has two surfaces backed by one governed demo workflow:

- Admin Web and API: <http://localhost:3000>
- Expo Mobile Web: <http://localhost:8081>

After `npm ci`, start them in separate terminals:

```bash
# Terminal 1
npm run demo:admin
```

```bash
# Terminal 2
npm run demo:mobile
```

These scripts deliberately set local demo values inline. A root `.env.local` is neither required nor recommended for judge testing. The Mobile Web API origin is a build/start-time Expo public value: `EXPO_PUBLIC_LEASEFLOW_API_URL=http://localhost:3000`.

Reset with Admin running:

```bash
npm run demo:reset
```

`LEASEFLOW_API_URL` may override the reset command's default Admin origin. The command retrieves the current revision before posting reset and retries once if another local action wins the revision race.

## Portable container demo

The repository includes provider-neutral OCI container definitions:

- `deploy/admin.Dockerfile` builds and serves the Next.js Admin/API process.
- `deploy/mobile.Dockerfile` exports Expo Web and serves static files with nginx.
- `compose.demo.yaml` binds Admin to port 3000 and Mobile to port 8081.

On a machine with Docker Compose:

```bash
docker compose -f compose.demo.yaml up --build
```

The Mobile bundle is built with `EXPO_PUBLIC_LEASEFLOW_API_URL=http://localhost:3000`. That value is intentionally a browser URL: a judge's browser, not the Mobile container, calls the Admin API. For a real public deployment, build the Mobile image with the final public HTTPS Admin origin, for example:

```bash
docker build -f deploy/mobile.Dockerfile \
  --build-arg EXPO_PUBLIC_LEASEFLOW_API_URL=https://admin.example.invalid \
  -t leaseflow-mobile-demo .
```

Replace the illustrative `.invalid` URL only after an Admin endpoint exists. The current public Admin URL and public Mobile URL are both **pending deployment**.

## Hosting contract and limitations

The Admin container is one Node process with a writable ephemeral JSON state directory. `compose.demo.yaml` mounts that directory as `tmpfs`, so a container restart resets persistence. A single writable replica is required; horizontal scaling, durable storage, backups, and distributed compare-and-swap are not provided.

The Mobile container is a static Expo Web export. `EXPO_PUBLIC_LEASEFLOW_API_URL` is embedded during the image build, so changing a runtime environment variable does not retarget an existing bundle; rebuild it instead. The Admin API must be reachable from the browser and use HTTPS when the Mobile site uses HTTPS.

This configuration contains no secrets and is strictly a synthetic hackathon demo. It does not provide or claim production Outlook/Microsoft Graph, email delivery, SSO, carrier-call, Supabase, or company-system integrations. External packages and reports remain human-approved sandbox actions.

Container execution was not performed in the current development environment because Docker is unavailable. The files are configuration-reviewed; local npm validation, tests, typechecking, Next production build, and Expo exports are the executable verification path.
