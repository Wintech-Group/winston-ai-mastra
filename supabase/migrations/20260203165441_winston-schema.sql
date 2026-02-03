-- INitialise schema for winston-ai mastra server

CREATE SCHEMA "mastra-winston-ai";

GRANT USAGE ON SCHEMA "mastra-winston-ai" TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA "mastra-winston-ai" TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA "mastra-winston-ai" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA "mastra-winston-ai" TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "mastra-winston-ai" GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "mastra-winston-ai" GRANT ALL ON ROUTINES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA "mastra-winston-ai" GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;