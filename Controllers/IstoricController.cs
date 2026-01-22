using Apacks.Depozit.Data;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Apacks.Depozit.Controllers;

public class IstoricController : Controller
{
    private readonly AppDbContext _db;

    public IstoricController(AppDbContext db)
    {
        _db = db;
    }

    public IActionResult Index()
    {
        return View("IstoricIndex");
    }

    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var logs = await _db.AuditLogs
            .OrderByDescending(l => l.Timestamp)
            .Take(500)
            .ToListAsync();
        return Json(logs);
    }

    [HttpPost]
    public async Task<IActionResult> Clear()
    {
        _db.AuditLogs.RemoveRange(_db.AuditLogs);
        await _db.SaveChangesAsync();
        return Json(new { success = true });
    }
}