using Apacks.Depozit.Models;
using Microsoft.Extensions.Options;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace Apacks.Depozit.Services;

public interface ICargusApiService
{
    Task<string?> GetTokenAsync();
    Task<List<CargusTrackingResponse>?> TrackAwbAsync(params string[] awbCodes);
    Task<CargusAwbDetailsResponse?> GetAwbDetailsAsync(string awbCode);
    Task<List<CargusRepaymentInfo>?> GetRepaymentsByAwbAsync(string awbCode);
    Task<List<CargusRepaymentInfo>?> GetRepaymentsByDateRangeAsync(DateTime fromDate, DateTime toDate);
    Task<byte[]?> GetAwbPdfAsync(params string[] awbCodes);
    Task<byte[]?> GetConfirmationImageAsync(string awbCode);
}

public class CargusApiService : ICargusApiService
{
    private readonly HttpClient _http;
    private readonly CargusApiConfig _config;
    private readonly ILogger<CargusApiService> _logger;
    private readonly CargusTokenCache _tokenCache = new();

    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public CargusApiService(
        HttpClient http,
        IOptions<CargusApiConfig> config,
        ILogger<CargusApiService> logger)
    {
        _http = http;
        _config = config.Value;
        _logger = logger;

        _http.BaseAddress = new Uri(_config.BaseUrl.TrimEnd('/') + "/");
        _http.DefaultRequestHeaders.Add("Ocp-Apim-Subscription-Key", _config.SubscriptionKey);
        _http.DefaultRequestHeaders.Add("Ocp-Apim-Trace", "true");
    }

    public async Task<string?> GetTokenAsync()
    {
        if (_tokenCache.IsValid)
            return _tokenCache.Token;

        try
        {
            var loginData = new CargusLoginRequest
            {
                UserName = _config.UserName,
                Password = _config.Password
            };

            var json = JsonSerializer.Serialize(loginData);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            // DEBUG: Log request details
            _logger.LogWarning("=== CARGUS LOGIN DEBUG ===");
            _logger.LogWarning("BaseUrl: {Url}", _config.BaseUrl);
            _logger.LogWarning("UserName: {User}", _config.UserName);
            _logger.LogWarning("SubscriptionKey length: {Len}", _config.SubscriptionKey?.Length ?? 0);

            var response = await _http.PostAsync("LoginUser", content);
            var responseBody = await response.Content.ReadAsStringAsync();

            _logger.LogWarning("Response Status: {Status}", response.StatusCode);
            _logger.LogWarning("Response Body: {Body}", responseBody);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Cargus login failed: {Status} - {Body}", response.StatusCode, responseBody);
                return null;
            }

            var token = responseBody.Trim('"');
            _tokenCache.Token = token;
            _tokenCache.ExpiresAt = DateTime.Now.AddHours(23);

            return token;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting Cargus token");
            return null;
        }
    }

    private async Task<HttpRequestMessage> CreateAuthorizedRequest(HttpMethod method, string url)
    {
        var token = await GetTokenAsync();
        var request = new HttpRequestMessage(method, url);

        if (!string.IsNullOrEmpty(token))
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        return request;
    }

    public async Task<List<CargusTrackingResponse>?> TrackAwbAsync(params string[] awbCodes)
    {
        if (awbCodes.Length == 0) return null;

        try
        {
            var jsonAwb = JsonSerializer.Serialize(awbCodes);
            var request = await CreateAuthorizedRequest(HttpMethod.Get,
                $"AwbTrace/WithRedirect?barCode={jsonAwb}");

            var response = await _http.SendAsync(request);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Cargus tracking failed: {Status}", response.StatusCode);
                return null;
            }

            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<List<CargusTrackingResponse>>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error tracking AWBs");
            return null;
        }
    }

    public async Task<CargusAwbDetailsResponse?> GetAwbDetailsAsync(string awbCode)
    {
        try
        {
            var request = await CreateAuthorizedRequest(HttpMethod.Get, $"Awbs?barCode={awbCode}");
            var response = await _http.SendAsync(request);

            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            var list = JsonSerializer.Deserialize<List<CargusAwbDetailsResponse>>(json, _jsonOptions);
            return list?.FirstOrDefault();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting AWB details");
            return null;
        }
    }

    public async Task<List<CargusRepaymentInfo>?> GetRepaymentsByAwbAsync(string awbCode)
    {
        try
        {
            var request = await CreateAuthorizedRequest(HttpMethod.Get, $"CashAccount?barCode={awbCode}");
            var response = await _http.SendAsync(request);

            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<List<CargusRepaymentInfo>>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting repayment");
            return null;
        }
    }

    public async Task<List<CargusRepaymentInfo>?> GetRepaymentsByDateRangeAsync(DateTime fromDate, DateTime toDate)
    {
        try
        {
            var from = fromDate.ToString("yyyy-MM-dd");
            var to = toDate.ToString("yyyy-MM-dd");

            var request = await CreateAuthorizedRequest(HttpMethod.Get,
                $"CashAccount/GetByDate?FromDate={from}&ToDate={to}");
            var response = await _http.SendAsync(request);

            if (!response.IsSuccessStatusCode) return null;

            var json = await response.Content.ReadAsStringAsync();
            return JsonSerializer.Deserialize<List<CargusRepaymentInfo>>(json, _jsonOptions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting repayments by date");
            return null;
        }
    }

    public async Task<byte[]?> GetAwbPdfAsync(params string[] awbCodes)
    {
        if (awbCodes.Length == 0) return null;

        try
        {
            var jsonAwb = JsonSerializer.Serialize(awbCodes);
            var request = await CreateAuthorizedRequest(HttpMethod.Get,
                $"AwbDocuments?barCodes={jsonAwb}&type=PDF&format=1&printMainOnce=1");

            var response = await _http.SendAsync(request);

            if (!response.IsSuccessStatusCode) return null;

            var base64 = await response.Content.ReadAsStringAsync();
            return Convert.FromBase64String(base64.Trim('"'));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error generating PDF");
            return null;
        }
    }

    public async Task<byte[]?> GetConfirmationImageAsync(string awbCode)
    {
        try
        {
            var request = await CreateAuthorizedRequest(HttpMethod.Get, $"AwbScan?barCodes={awbCode}");
            var response = await _http.SendAsync(request);

            if (!response.IsSuccessStatusCode) return null;

            var base64 = await response.Content.ReadAsStringAsync();
            if (string.IsNullOrWhiteSpace(base64) || base64 == "null") return null;

            return Convert.FromBase64String(base64.Trim('"'));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting confirmation image");
            return null;
        }
    }
}
