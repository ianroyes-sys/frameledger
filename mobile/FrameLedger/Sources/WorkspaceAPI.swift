import Foundation

/// Read-only integration boundary. This build intentionally has no live sign-in UI.
/// The caller must obtain a short-lived Supabase user session, never a service key.
struct WorkspaceAPI {
  enum Failure: Error { case insecureOrigin, invalidSession, serviceUnavailable, oversizedResponse }
  let origin: URL
  init(origin: URL) throws {
    guard origin.scheme == "https", origin.user == nil, origin.password == nil, origin.query == nil,
      origin.fragment == nil
    else { throw Failure.insecureOrigin }
    self.origin = origin
  }
  func readWorkspace(businessID: UUID, userAccessToken: String) async throws -> Data {
    guard !userAccessToken.isEmpty else { throw Failure.invalidSession }
    var components = URLComponents(
      url: origin.appending(path: "api/workspace"), resolvingAgainstBaseURL: false)!
    components.queryItems = [URLQueryItem(name: "businessId", value: businessID.uuidString)]
    var request = URLRequest(url: components.url!)
    request.setValue("Bearer \(userAccessToken)", forHTTPHeaderField: "Authorization")
    request.cachePolicy = .reloadIgnoringLocalCacheData
    request.timeoutInterval = 20
    let configuration = URLSessionConfiguration.ephemeral
    configuration.httpShouldSetCookies = false
    let session = URLSession(configuration: configuration)
    defer { session.invalidateAndCancel() }
    let (data, response) = try await session.data(for: request)
    guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
      throw Failure.serviceUnavailable
    }
    guard data.count < 5_000_000 else { throw Failure.oversizedResponse }
    return data
  }
}
