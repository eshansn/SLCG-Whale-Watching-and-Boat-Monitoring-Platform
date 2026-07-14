using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace WhaleWatching.Api.Data;

public sealed class WhaleWatchingDbContextFactory
    : IDesignTimeDbContextFactory<WhaleWatchingDbContext>
{
    public WhaleWatchingDbContext CreateDbContext(string[] args)
    {
        var connectionString = Environment.GetEnvironmentVariable(
            "ConnectionStrings__SqlServer")
            ?? "Server=localhost,1433;Database=WhaleWatching;User Id=sa;" +
               "Password=Design_Time_Only_123!;Encrypt=True;TrustServerCertificate=True";

        var options = new DbContextOptionsBuilder<WhaleWatchingDbContext>()
            .UseSqlServer(connectionString)
            .Options;

        return new WhaleWatchingDbContext(options);
    }
}
