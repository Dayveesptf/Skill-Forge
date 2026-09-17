import { Link } from "react-router-dom";
import { Card, PageHeader } from "../components/ui";

export default function NotFoundPage() {
  return (
    <>
      <PageHeader
        title="Page not found"
        description="The page you requested does not exist."
      />

      <Card className="p-8 text-center">
        <div className="mx-auto max-w-md">
          <p className="text-6xl font-bold tracking-tight text-white">404</p>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            We couldn't find the page you're looking for. It may have been
            moved, removed, or the URL may be incorrect.
          </p>

          <div className="mt-6">
            <Link className="btn-primary" to="/dashboard">
              Return to dashboard
            </Link>
          </div>
        </div>
      </Card>
    </>
  );
}