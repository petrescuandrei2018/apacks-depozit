using Apacks.Depozit.Models;
using Microsoft.EntityFrameworkCore;

namespace Apacks.Depozit.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Awb> Awbs => Set<Awb>();
    public DbSet<AwbMedia> AwbMedia => Set<AwbMedia>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
}