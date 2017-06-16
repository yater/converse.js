import os
import unittest
import threading
import SimpleHTTPServer
import SocketServer

from selenium import webdriver

DOMAIN = '127.0.0.1'
PORT = 8088

class TestServer(SocketServer.TCPServer):
    allow_reuse_address = True


class SeleniumTests(unittest.TestCase):

    def setUp(self):
        os.chdir('../../')
	Handler = SimpleHTTPServer.SimpleHTTPRequestHandler
	httpd = TestServer(("", PORT), Handler)
        httpd_thread = threading.Thread(target=httpd.serve_forever)
        httpd_thread.setDaemon(True)
        httpd_thread.start()
	print "serving at port", PORT
        self.driver = webdriver.Chrome()

    def test_load_inverse(self):
        self.driver.get("http://{}:{}/inverse-dev.html".format(DOMAIN, PORT))
        assert("inVerse" in self.driver.title)
        
    def tearDown(self):
        self.driver.quit()
        

if __name__ == "__main__":
    unittest.main()


