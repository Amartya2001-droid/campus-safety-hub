import requests
import json
from datetime import datetime
import uuid

# Base URL for the API
BASE_URL = "https://campus-guardian-4.preview.emergentagent.com/api"

# Test credentials
TEST_EMAIL = "nitish.sahni@acadiau.ca"
TEST_PASSWORD = "test123"

class AcadiaSafeAPITester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_data = None
        self.test_results = {}
        
    def log_result(self, test_name, success, details="", response_data=None):
        """Log test results"""
        self.test_results[test_name] = {
            "success": success,
            "details": details,
            "response_data": response_data,
            "timestamp": datetime.now().isoformat()
        }
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} {test_name}: {details}")
        if response_data and not success:
            print(f"    Response: {response_data}")
    
    def get_headers(self, include_auth=False):
        """Get headers for API requests"""
        headers = {"Content-Type": "application/json"}
        if include_auth and self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        return headers
    
    def test_health_check(self):
        """Test basic health endpoints"""
        print("\n=== Testing Health Check ===")
        
        try:
            # Test root endpoint
            response = requests.get(f"{self.base_url}/")
            if response.status_code == 200:
                data = response.json()
                if data.get("message") == "Acadia Safe API":
                    self.log_result("Root Health Check", True, "API root accessible")
                else:
                    self.log_result("Root Health Check", False, "Unexpected root response", data)
            else:
                self.log_result("Root Health Check", False, f"Status {response.status_code}", response.text)
                
            # Test health endpoint
            response = requests.get(f"{self.base_url}/health")
            if response.status_code == 200:
                data = response.json()
                if data.get("status") == "healthy":
                    self.log_result("Health Endpoint", True, "Health check passed")
                else:
                    self.log_result("Health Endpoint", False, "Health status not healthy", data)
            else:
                self.log_result("Health Endpoint", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Health Check", False, f"Connection error: {str(e)}")
    
    def test_authentication(self):
        """Test user authentication flow"""
        print("\n=== Testing Authentication ===")
        
        # Test login with existing credentials
        try:
            login_data = {
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
            
            response = requests.post(
                f"{self.base_url}/auth/login",
                json=login_data,
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.token = data["token"]
                    self.user_data = data["user"]
                    self.log_result("User Login", True, f"Successfully logged in as {data['user']['full_name']}")
                else:
                    self.log_result("User Login", False, "Missing token or user in response", data)
            else:
                # If login fails, try to signup first
                if response.status_code == 401:
                    self.test_signup()
                    return self.test_authentication()  # Retry login after signup
                else:
                    self.log_result("User Login", False, f"Status {response.status_code}", response.text)
                    
        except Exception as e:
            self.log_result("User Login", False, f"Error: {str(e)}")
    
    def test_signup(self):
        """Test user signup (in case user doesn't exist)"""
        print("\n=== Testing Signup ===")
        
        try:
            signup_data = {
                "full_name": "Nitish Sahni",
                "email": TEST_EMAIL,
                "phone": "+1-902-555-0123",
                "password": TEST_PASSWORD
            }
            
            response = requests.post(
                f"{self.base_url}/auth/signup",
                json=signup_data,
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.token = data["token"]
                    self.user_data = data["user"]
                    self.log_result("User Signup", True, f"Successfully signed up as {data['user']['full_name']}")
                else:
                    self.log_result("User Signup", False, "Missing token or user in response", data)
            elif response.status_code == 400 and "already registered" in response.text:
                self.log_result("User Signup", True, "User already exists (expected)")
            else:
                self.log_result("User Signup", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("User Signup", False, f"Error: {str(e)}")
    
    def test_auth_me(self):
        """Test getting current user"""
        print("\n=== Testing Auth Me ===")
        
        if not self.token:
            self.log_result("Auth Me", False, "No token available")
            return
            
        try:
            response = requests.get(
                f"{self.base_url}/auth/me",
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and "email" in data:
                    self.log_result("Auth Me", True, f"Retrieved user profile for {data['email']}")
                else:
                    self.log_result("Auth Me", False, "Missing user data", data)
            else:
                self.log_result("Auth Me", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Auth Me", False, f"Error: {str(e)}")
    
    def test_profile_update(self):
        """Test profile update"""
        print("\n=== Testing Profile Update ===")
        
        if not self.token:
            self.log_result("Profile Update", False, "No token available")
            return
            
        try:
            update_data = {
                "emergency_contact_name": "John Doe",
                "emergency_contact_phone": "+1-902-555-9999"
            }
            
            response = requests.put(
                f"{self.base_url}/auth/profile",
                json=update_data,
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if data.get("emergency_contact_name") == "John Doe":
                    self.log_result("Profile Update", True, "Successfully updated profile")
                else:
                    self.log_result("Profile Update", False, "Profile not updated correctly", data)
            else:
                self.log_result("Profile Update", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Profile Update", False, f"Error: {str(e)}")
    
    def test_trusted_contacts(self):
        """Test trusted contacts CRUD operations"""
        print("\n=== Testing Trusted Contacts ===")
        
        if not self.token:
            self.log_result("Trusted Contacts", False, "No token available")
            return
            
        contact_id = None
        
        try:
            # Test adding contact
            contact_data = {
                "name": "Jane Smith",
                "phone": "+1-902-555-7777",
                "relationship": "Friend"
            }
            
            response = requests.post(
                f"{self.base_url}/contacts",
                json=contact_data,
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data.get("name") == "Jane Smith":
                    contact_id = data["id"]
                    self.log_result("Add Trusted Contact", True, f"Added contact: {data['name']}")
                else:
                    self.log_result("Add Trusted Contact", False, "Invalid contact response", data)
            else:
                self.log_result("Add Trusted Contact", False, f"Status {response.status_code}", response.text)
                
            # Test getting contacts
            response = requests.get(
                f"{self.base_url}/contacts",
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get Trusted Contacts", True, f"Retrieved {len(data)} contacts")
                else:
                    self.log_result("Get Trusted Contacts", False, "Invalid contacts response", data)
            else:
                self.log_result("Get Trusted Contacts", False, f"Status {response.status_code}", response.text)
                
            # Test deleting contact
            if contact_id:
                response = requests.delete(
                    f"{self.base_url}/contacts/{contact_id}",
                    headers=self.get_headers(include_auth=True)
                )
                
                if response.status_code == 200:
                    self.log_result("Delete Trusted Contact", True, "Successfully deleted contact")
                else:
                    self.log_result("Delete Trusted Contact", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Trusted Contacts", False, f"Error: {str(e)}")
    
    def test_sos_alerts(self):
        """Test SOS alert operations"""
        print("\n=== Testing SOS Alerts ===")
        
        if not self.token:
            self.log_result("SOS Alerts", False, "No token available")
            return
            
        sos_id = None
        
        try:
            # Test creating SOS alert
            sos_data = {
                "location_lat": 45.0875,
                "location_lng": -64.3665,
                "alert_type": "emergency"
            }
            
            response = requests.post(
                f"{self.base_url}/sos",
                json=sos_data,
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data.get("status") == "active":
                    sos_id = data["id"]
                    self.log_result("Create SOS Alert", True, f"Created SOS alert: {sos_id}")
                else:
                    self.log_result("Create SOS Alert", False, "Invalid SOS alert response", data)
            else:
                self.log_result("Create SOS Alert", False, f"Status {response.status_code}", response.text)
                
            # Test getting active SOS
            response = requests.get(
                f"{self.base_url}/sos/active",
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if data and data.get("status") == "active":
                    self.log_result("Get Active SOS", True, "Retrieved active SOS alert")
                elif data is None:
                    self.log_result("Get Active SOS", True, "No active SOS (expected if none exists)")
                else:
                    self.log_result("Get Active SOS", False, "Invalid SOS response", data)
            else:
                self.log_result("Get Active SOS", False, f"Status {response.status_code}", response.text)
                
            # Test cancelling SOS
            if sos_id:
                response = requests.put(
                    f"{self.base_url}/sos/{sos_id}/cancel",
                    headers=self.get_headers(include_auth=True)
                )
                
                if response.status_code == 200:
                    self.log_result("Cancel SOS Alert", True, "Successfully cancelled SOS alert")
                else:
                    self.log_result("Cancel SOS Alert", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("SOS Alerts", False, f"Error: {str(e)}")
    
    def test_incidents(self):
        """Test incident reporting"""
        print("\n=== Testing Incident Reports ===")
        
        if not self.token:
            self.log_result("Incident Reports", False, "No token available")
            return
            
        incident_id = None
        
        try:
            # Test creating incident
            incident_data = {
                "incident_type": "suspicious_activity",
                "location_lat": 45.0880,
                "location_lng": -64.3670,
                "location_name": "Library Parking Lot",
                "description": "Suspicious person loitering near vehicles",
                "is_anonymous": False,
                "wants_contact": True,
                "contact_phone": "+1-902-555-1234"
            }
            
            response = requests.post(
                f"{self.base_url}/incidents",
                json=incident_data,
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data.get("incident_type") == "suspicious_activity":
                    incident_id = data["id"]
                    self.log_result("Create Incident Report", True, f"Created incident: {incident_id}")
                else:
                    self.log_result("Create Incident Report", False, "Invalid incident response", data)
            else:
                self.log_result("Create Incident Report", False, f"Status {response.status_code}", response.text)
                
            # Test getting my incidents
            response = requests.get(
                f"{self.base_url}/incidents/my",
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list):
                    self.log_result("Get My Incidents", True, f"Retrieved {len(data)} incidents")
                else:
                    self.log_result("Get My Incidents", False, "Invalid incidents response", data)
            else:
                self.log_result("Get My Incidents", False, f"Status {response.status_code}", response.text)
                
            # Test getting specific incident
            if incident_id:
                response = requests.get(
                    f"{self.base_url}/incidents/{incident_id}",
                    headers=self.get_headers(include_auth=True)
                )
                
                if response.status_code == 200:
                    data = response.json()
                    if data.get("id") == incident_id:
                        self.log_result("Get Specific Incident", True, "Retrieved incident details")
                    else:
                        self.log_result("Get Specific Incident", False, "Wrong incident returned", data)
                else:
                    self.log_result("Get Specific Incident", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Incident Reports", False, f"Error: {str(e)}")
    
    def test_escort_requests(self):
        """Test escort request operations"""
        print("\n=== Testing Escort Requests ===")
        
        if not self.token:
            self.log_result("Escort Requests", False, "No token available")
            return
            
        escort_id = None
        
        try:
            # Test creating escort request
            escort_data = {
                "pickup_lat": 45.0875,
                "pickup_lng": -64.3665,
                "pickup_name": "Library",
                "destination_lat": 45.0885,
                "destination_lng": -64.3675,
                "destination_name": "Student Union Building",
                "notes": "Walking alone late at night"
            }
            
            response = requests.post(
                f"{self.base_url}/escorts",
                json=escort_data,
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data.get("status") == "pending":
                    escort_id = data["id"]
                    self.log_result("Create Escort Request", True, f"Created escort request: {escort_id}")
                else:
                    self.log_result("Create Escort Request", False, "Invalid escort response", data)
            else:
                self.log_result("Create Escort Request", False, f"Status {response.status_code}", response.text)
                
            # Test getting active escort
            response = requests.get(
                f"{self.base_url}/escorts/active",
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if data and data.get("status") in ["pending", "assigned"]:
                    self.log_result("Get Active Escort", True, "Retrieved active escort request")
                elif data is None:
                    self.log_result("Get Active Escort", True, "No active escort (expected if none exists)")
                else:
                    self.log_result("Get Active Escort", False, "Invalid escort response", data)
            else:
                self.log_result("Get Active Escort", False, f"Status {response.status_code}", response.text)
                
            # Test assigning officer (mock endpoint)
            if escort_id:
                response = requests.put(
                    f"{self.base_url}/escorts/{escort_id}/assign",
                    headers=self.get_headers(include_auth=True)
                )
                
                if response.status_code == 200:
                    self.log_result("Assign Officer", True, "Successfully assigned officer")
                else:
                    self.log_result("Assign Officer", False, f"Status {response.status_code}", response.text)
                
                # Test cancelling escort
                response = requests.put(
                    f"{self.base_url}/escorts/{escort_id}/cancel",
                    headers=self.get_headers(include_auth=True)
                )
                
                if response.status_code == 200:
                    self.log_result("Cancel Escort Request", True, "Successfully cancelled escort request")
                else:
                    self.log_result("Cancel Escort Request", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Escort Requests", False, f"Error: {str(e)}")
    
    def test_friend_walk(self):
        """Test friend walk operations"""
        print("\n=== Testing Friend Walk ===")
        
        if not self.token:
            self.log_result("Friend Walk", False, "No token available")
            return
            
        walk_id = None
        
        try:
            # Add a trusted contact first for friend walk
            contact_data = {
                "name": "Test Friend",
                "phone": "+1-902-555-8888",
                "relationship": "Friend"
            }
            
            contact_response = requests.post(
                f"{self.base_url}/contacts",
                json=contact_data,
                headers=self.get_headers(include_auth=True)
            )
            
            contact_id = None
            if contact_response.status_code == 200:
                contact_id = contact_response.json().get("id")
            
            # Test starting friend walk
            walk_data = {
                "contact_ids": [contact_id] if contact_id else [],
                "duration_minutes": 30,
                "location_lat": 45.0875,
                "location_lng": -64.3665
            }
            
            response = requests.post(
                f"{self.base_url}/friend-walk",
                json=walk_data,
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if "id" in data and data.get("status") == "active":
                    walk_id = data["id"]
                    self.log_result("Start Friend Walk", True, f"Started friend walk: {walk_id}")
                else:
                    self.log_result("Start Friend Walk", False, "Invalid friend walk response", data)
            else:
                self.log_result("Start Friend Walk", False, f"Status {response.status_code}", response.text)
                
            # Test getting active friend walk
            response = requests.get(
                f"{self.base_url}/friend-walk/active",
                headers=self.get_headers(include_auth=True)
            )
            
            if response.status_code == 200:
                data = response.json()
                if data and data.get("status") == "active":
                    self.log_result("Get Active Friend Walk", True, "Retrieved active friend walk")
                elif data is None:
                    self.log_result("Get Active Friend Walk", True, "No active friend walk (expected if none exists)")
                else:
                    self.log_result("Get Active Friend Walk", False, "Invalid friend walk response", data)
            else:
                self.log_result("Get Active Friend Walk", False, f"Status {response.status_code}", response.text)
                
            if walk_id:
                # Test updating location
                update_data = {
                    "location_lat": 45.0880,
                    "location_lng": -64.3670
                }
                
                response = requests.put(
                    f"{self.base_url}/friend-walk/{walk_id}/update",
                    json=update_data,
                    headers=self.get_headers(include_auth=True)
                )
                
                if response.status_code == 200:
                    self.log_result("Update Friend Walk Location", True, "Updated location successfully")
                else:
                    self.log_result("Update Friend Walk Location", False, f"Status {response.status_code}", response.text)
                
                # Test extending walk
                response = requests.put(
                    f"{self.base_url}/friend-walk/{walk_id}/extend?minutes=15",
                    headers=self.get_headers(include_auth=True)
                )
                
                if response.status_code == 200:
                    self.log_result("Extend Friend Walk", True, "Extended walk duration")
                else:
                    self.log_result("Extend Friend Walk", False, f"Status {response.status_code}", response.text)
                
                # Test completing walk
                response = requests.put(
                    f"{self.base_url}/friend-walk/{walk_id}/complete",
                    headers=self.get_headers(include_auth=True)
                )
                
                if response.status_code == 200:
                    self.log_result("Complete Friend Walk", True, "Completed friend walk successfully")
                else:
                    self.log_result("Complete Friend Walk", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Friend Walk", False, f"Error: {str(e)}")
    
    def test_campus_alerts(self):
        """Test campus alerts"""
        print("\n=== Testing Campus Alerts ===")
        
        try:
            # Seed data first
            seed_response = requests.post(
                f"{self.base_url}/seed",
                headers=self.get_headers()
            )
            
            # Test getting all alerts
            response = requests.get(
                f"{self.base_url}/alerts",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    self.log_result("Get Campus Alerts", True, f"Retrieved {len(data)} campus alerts")
                    
                    # Test getting specific alert
                    alert_id = data[0].get("id")
                    if alert_id:
                        alert_response = requests.get(
                            f"{self.base_url}/alerts/{alert_id}",
                            headers=self.get_headers()
                        )
                        
                        if alert_response.status_code == 200:
                            alert_data = alert_response.json()
                            if alert_data.get("id") == alert_id:
                                self.log_result("Get Specific Alert", True, "Retrieved specific alert details")
                            else:
                                self.log_result("Get Specific Alert", False, "Wrong alert returned", alert_data)
                        else:
                            self.log_result("Get Specific Alert", False, f"Status {alert_response.status_code}", alert_response.text)
                else:
                    self.log_result("Get Campus Alerts", False, "No alerts returned or invalid format", data)
            else:
                self.log_result("Get Campus Alerts", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Campus Alerts", False, f"Error: {str(e)}")
    
    def test_campus_locations(self):
        """Test campus locations"""
        print("\n=== Testing Campus Locations ===")
        
        try:
            # Test getting all locations
            response = requests.get(
                f"{self.base_url}/locations",
                headers=self.get_headers()
            )
            
            if response.status_code == 200:
                data = response.json()
                if isinstance(data, list) and len(data) > 0:
                    self.log_result("Get Campus Locations", True, f"Retrieved {len(data)} campus locations")
                    
                    # Test filtering by type
                    filter_response = requests.get(
                        f"{self.base_url}/locations?location_type=emergency_phone",
                        headers=self.get_headers()
                    )
                    
                    if filter_response.status_code == 200:
                        filtered_data = filter_response.json()
                        if isinstance(filtered_data, list):
                            self.log_result("Filter Locations by Type", True, f"Retrieved {len(filtered_data)} emergency phones")
                        else:
                            self.log_result("Filter Locations by Type", False, "Invalid filter response", filtered_data)
                    else:
                        self.log_result("Filter Locations by Type", False, f"Status {filter_response.status_code}", filter_response.text)
                        
                else:
                    self.log_result("Get Campus Locations", False, "No locations returned or invalid format", data)
            else:
                self.log_result("Get Campus Locations", False, f"Status {response.status_code}", response.text)
                
        except Exception as e:
            self.log_result("Campus Locations", False, f"Error: {str(e)}")
    
    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting Acadia Safe API Testing")
        print(f"Base URL: {self.base_url}")
        print(f"Test User: {TEST_EMAIL}")
        
        # Run tests in order
        self.test_health_check()
        self.test_authentication()
        self.test_auth_me()
        self.test_profile_update()
        self.test_trusted_contacts()
        self.test_sos_alerts()
        self.test_incidents()
        self.test_escort_requests()
        self.test_friend_walk()
        self.test_campus_alerts()
        self.test_campus_locations()
        
        # Print summary
        print("\n" + "="*60)
        print("🎯 TEST SUMMARY")
        print("="*60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() if result["success"])
        failed_tests = total_tests - passed_tests
        
        print(f"Total Tests: {total_tests}")
        print(f"Passed: {passed_tests} ✅")
        print(f"Failed: {failed_tests} ❌")
        print(f"Success Rate: {(passed_tests/total_tests*100):.1f}%")
        
        if failed_tests > 0:
            print("\n❌ FAILED TESTS:")
            for test_name, result in self.test_results.items():
                if not result["success"]:
                    print(f"  • {test_name}: {result['details']}")
        
        print("\n✅ PASSED TESTS:")
        for test_name, result in self.test_results.items():
            if result["success"]:
                print(f"  • {test_name}: {result['details']}")
        
        return {
            "total": total_tests,
            "passed": passed_tests,
            "failed": failed_tests,
            "success_rate": passed_tests/total_tests*100,
            "results": self.test_results
        }

if __name__ == "__main__":
    tester = AcadiaSafeAPITester()
    results = tester.run_all_tests()