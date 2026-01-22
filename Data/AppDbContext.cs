using Apacks.Depozit.Models;
using Microsoft.EntityFrameworkCore;

namespace Apacks.Depozit.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Awb> Awbs => Set<Awb>();
    public DbSet<AwbMedia> AwbMedia => Set<AwbMedia>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    // Pentru coletele extrase din PDF
    public DbSet<AwbColet> AwbColete => Set<AwbColet>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<AwbColet>()
            .HasIndex(c => c.AwbCode);

        modelBuilder.Entity<AwbColet>()
            .HasIndex(c => c.Status);

        modelBuilder.Entity<AwbColet>()
            .HasIndex(c => c.Destinatar);
    }
}