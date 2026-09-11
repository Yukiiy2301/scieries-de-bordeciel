import { useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import { Trees } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="text-center">
        <div className="brand-icon mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl shadow-xl shadow-orange-900/50">
          <Trees className="h-7 w-7 text-stone-950" />
        </div>
        <h1 className="font-display gold-text text-5xl font-bold">404</h1>
        <p className="mb-4 mt-2 text-muted-foreground">
          Cette page n'existe pas dans le registre des scieries.
        </p>
        <Link
          to="/"
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
