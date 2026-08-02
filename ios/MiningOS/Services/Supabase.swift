import Foundation
import Supabase

/// Reads the Supabase config injected into Info.plist from Config/Secrets.xcconfig.
enum AppConfig {
    static var supabaseURL: URL {
        guard
            let raw = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_URL") as? String,
            !raw.isEmpty,
            let url = URL(string: raw)
        else {
            fatalError("SUPABASE_URL missing. Copy Config/Secrets.example.xcconfig to Config/Secrets.xcconfig and fill it in.")
        }
        return url
    }

    static var supabaseAnonKey: String {
        guard
            let key = Bundle.main.object(forInfoDictionaryKey: "SUPABASE_ANON_KEY") as? String,
            !key.isEmpty
        else {
            fatalError("SUPABASE_ANON_KEY missing. See Config/Secrets.example.xcconfig.")
        }
        return key
    }
}

/// Single shared client for the whole app.
let supabase = SupabaseClient(
    supabaseURL: AppConfig.supabaseURL,
    supabaseKey: AppConfig.supabaseAnonKey
)
