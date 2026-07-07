global using Xunit;
global using FluentAssertions;

// AuthApiFactory and MessengerApiFactory both stash their Testcontainers connection strings in
// process-wide environment variables for Program.cs to pick up. xUnit runs different [Collection]s
// in parallel by default, so two factories alive at once would race to overwrite each other's env
// vars. Forcing collections to run sequentially keeps only one factory's env vars live at a time.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
