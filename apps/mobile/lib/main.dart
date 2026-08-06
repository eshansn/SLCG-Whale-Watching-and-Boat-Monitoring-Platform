import 'package:flutter/material.dart';

// --- AUTHENTICATION SCREENS ---
import 'screens/auth/welcome_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/signup_step1.dart';

// --- SHORE SCREENS ---
import 'screens/shore/shore_dashboard.dart';
import 'screens/shore/trips_list_screen.dart';
import 'screens/shore/vessel_details_screen.dart';
import 'screens/shore/shore_notifications_screen.dart';
import 'screens/shore/shore_settings_screen.dart';

// --- BOAT OWNER SCREENS ---
import 'screens/owner/boat_owner_dashboard.dart';
import 'screens/owner/owner_profile_screen.dart';
import 'screens/owner/owner_boats_screen.dart';
import 'screens/owner/owner_new_boat_screen.dart';
import 'screens/owner/owner_trips_screen.dart';
import 'screens/owner/owner_new_trip_screen.dart';
import 'screens/owner/owner_trip_info_screen.dart';
import 'screens/owner/owner_my_crew_screen.dart';
import 'screens/owner/owner_settings_screen.dart';
import 'screens/owner/owner_boat_info_screen.dart';
import 'screens/owner/owner_notifications_screen.dart';
import 'screens/crew/boat_crew_dashboard.dart';
import 'screens/passenger/trip_registration_screen.dart';
import 'screens/shore_wildlife/shore_wildlife_portal.dart';
import 'widgets/auth_gate.dart';
import 'services/api_service.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await ApiService.instance.restore();
  runApp(const WwmsApp());
}

class WwmsApp extends StatelessWidget {
  const WwmsApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'WWMS Platform',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF162D54),
          primary: const Color(0xFF162D54),
          surface: Colors.white,
        ),
        scaffoldBackgroundColor: const Color(0xFFF8F9FB),
        fontFamily: 'Poppins',
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.white,
          foregroundColor: Color(0xFF14223D),
          surfaceTintColor: Colors.transparent,
          elevation: 0,
          centerTitle: true,
        ),
        cardTheme: CardThemeData(
          color: Colors.white,
          elevation: 2,
          shadowColor: Colors.black.withValues(alpha: .12),
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        ),
        inputDecorationTheme: InputDecorationTheme(
          filled: true,
          fillColor: const Color(0xFFF8F9FB),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: BorderSide.none,
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(12),
            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
          ),
        ),
        elevatedButtonTheme: ElevatedButtonThemeData(
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF162D54),
            foregroundColor: Colors.white,
            minimumSize: const Size(0, 48),
            shape:
                RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
          ),
        ),
      ),
      initialRoute: switch (ApiService.instance.role) {
        'ShoreCrew' => '/shore_dashboard',
        'BoatOwner' => '/boat_owner',
        'BoatCrew' => '/boat_crew',
        'ShoreWildlife' => '/shore_wildlife',
        _ => '/',
      },
      routes: {
        '/': (context) => const WelcomeScreen(),
        '/login': (context) => const LoginScreen(),
        '/signup_step1': (context) => const SignupStep1(),

        // Shore Routes
        '/shore_dashboard': (context) =>
            const AuthGate(roles: ['ShoreCrew'], child: ShoreDashboard()),
        '/trips_list': (context) =>
            const AuthGate(roles: ['ShoreCrew'], child: TripsListScreen()),
        '/vessel_details': (context) =>
            const AuthGate(roles: ['ShoreCrew'], child: VesselDetailsScreen()),
        '/shore_notifications': (context) => const AuthGate(
            roles: ['ShoreCrew'], child: ShoreNotificationsScreen()),
        '/shore_settings': (context) =>
            const AuthGate(roles: ['ShoreCrew'], child: ShoreSettingsScreen()),

        // Boat Owner Routes
        '/boat_owner': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: BoatOwnerDashboard()),
        '/owner_profile': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: OwnerProfileScreen()),
        '/owner_boats': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: OwnerBoatsScreen()),
        '/owner_new_boat': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: OwnerNewBoatScreen()),
        '/owner_trips': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: OwnerTripsScreen()),
        '/owner_new_trip': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: OwnerNewTripScreen()),
        '/owner_trip_info': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: OwnerTripInfoScreen()),
        '/owner_my_crew': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: OwnerMyCrewScreen()),
        '/owner_settings': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: OwnerSettingsScreen()),
        '/owner_boat_info': (context) =>
            const AuthGate(roles: ['BoatOwner'], child: OwnerBoatInfoScreen()),
        '/owner_notifications': (context) => const AuthGate(
            roles: ['BoatOwner'], child: OwnerNotificationsScreen()),
        '/boat_crew': (context) =>
            const AuthGate(roles: ['BoatCrew'], child: BoatCrewDashboard()),
        '/crew_profile': (context) =>
            const AuthGate(roles: ['BoatCrew'], child: BoatCrewProfileScreen()),
        '/crew_trips': (context) =>
            const AuthGate(roles: ['BoatCrew'], child: BoatCrewTripsScreen()),
        '/crew_trip_info': (context) => const AuthGate(
            roles: ['BoatCrew'], child: BoatCrewTripDetailsScreen()),
        '/crew_notifications': (context) => const AuthGate(
            roles: ['BoatCrew'], child: BoatCrewNotificationsScreen()),
        '/crew_settings': (context) => const AuthGate(
            roles: ['BoatCrew'], child: BoatCrewSettingsScreen()),
        '/shore_wildlife': (context) => const AuthGate(
            roles: ['ShoreWildlife'], child: ShoreWildlifeTripsScreen()),
        '/shore_wildlife_trip': (context) => const AuthGate(
            roles: ['ShoreWildlife'], child: ShoreWildlifeTripScreen()),
        '/trip-register': (context) => const TripRegistrationScreen(),
      },
    );
  }
}
